#!/usr/bin/env python3
"""Compara el enrutamiento de una skill antes y después de un cambio usando sus eval_cases.

Uso:
  diff_skill_evals.py --after .agent/skills/<skill> [--before <dir|respaldo.tar.gz>]
                      [--cases eval_cases.json] [--catalog .agent/skills] [--threshold 0.25]
                      [--judge-cmd "<comando>"] [--judge-timeout 60] [--fail-on-miss]

Método por defecto (lexical-proxy-v3, implementado en crear-skills/scripts/routing_score.py):
  puntuación = aciertos en la parte positiva de la description / raíz(tamaño)
             - aciertos que solo están en "No usar…" / raíz(tamaño)
             + hasta 0.5 según la fracción de términos del nombre presentes
             + 0.5 si la petición nombra la skill ("la skill <nombre>"; la mención no puntúa
               como vocabulario para ninguna skill).
  La skill se considera activada si su puntuación >= umbral y ninguna skill del
  catálogo (--catalog) puntúa más. Sirve para detectar regresiones relativas entre
  versiones de una description; no reproduce el enrutador del modelo.

--judge-cmd sustituye el proxy por un comando externo. Se ejecuta sin shell, recibe por
stdin {"prompt", "skill": {"name", "description"}, "competitors": [...]} y debe imprimir
"true"/"false" o {"activate": true|false}. Envía las descriptions a ese proceso: úsalo solo
con permiso del usuario.

Sin --before: mide la línea base de --after.
Códigos: 0 sin regresiones, 1 regresiones (o fallos con --fail-on-miss), 2 error de entrada,
3 fallo del juez externo.
"""

import argparse
import json
import shlex
import subprocess
import sys
import tarfile
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SHARED = HERE.parent.parent / "crear-skills" / "scripts"
sys.path.insert(0, str(SHARED))
try:
    from routing_score import METHOD, route_score  # noqa: E402
    from validate_skill import parse_frontmatter, split_frontmatter  # noqa: E402
except ImportError:
    print(json.dumps({"error": f"No se encuentra crear-skills/scripts en {SHARED}. Instala crear-skills."}, ensure_ascii=False))
    sys.exit(2)


def fail(msg, code=2):
    print(json.dumps({"error": msg}, ensure_ascii=False))
    sys.exit(code)


def parse_skill_text(text, fallback_name):
    raw, _, _ = split_frontmatter(text)
    fm = parse_frontmatter(raw)[0] if raw else {}
    return str(fm.get("name") or fallback_name), str(fm.get("description") or "")


def load_version(path):
    p = Path(path)
    if p.is_dir():
        skill_md = p / "SKILL.md"
        if not skill_md.is_file():
            fail(f"No existe {skill_md}")
        return parse_skill_text(skill_md.read_text(encoding="utf-8"), p.name)
    if p.is_file() and p.name.endswith((".tar.gz", ".tgz", ".tar")):
        with tarfile.open(p) as tar:
            members = sorted((m for m in tar.getmembers() if m.name.endswith("SKILL.md")), key=lambda m: m.name.count("/"))
            if not members:
                fail(f"El respaldo {p} no contiene SKILL.md")
            text = tar.extractfile(members[0]).read().decode("utf-8")
            return parse_skill_text(text, Path(members[0].name).parent.name)
    fail(f"Ruta no válida para una versión de skill: {p}")


def load_catalog(catalog, exclude):
    out = []
    if not catalog:
        return out
    base = Path(catalog)
    if not base.is_dir():
        fail(f"No existe el catálogo: {base}")
    for skill_md in sorted(base.glob("*/SKILL.md")):
        if ".backup." in skill_md.parent.name:
            continue
        name, desc = parse_skill_text(skill_md.read_text(encoding="utf-8"), skill_md.parent.name)
        if name != exclude:
            out.append((name, desc))
    return out


def predict_proxy(prompt, name, desc, competitors, threshold):
    own = route_score(prompt, name, desc)["score"]
    best_name, best_score = None, float("-inf")
    for cname, cdesc in competitors:
        s = route_score(prompt, cname, cdesc)["score"]
        if s > best_score:
            best_name, best_score = cname, s
    activated = own >= threshold and (best_name is None or own >= best_score)
    return {"activated": activated, "score": own,
            "best_competitor": best_name, "competitor_score": None if best_name is None else best_score}


def predict_judge(cmd, timeout, prompt, name, desc, competitors):
    payload = json.dumps({"prompt": prompt, "skill": {"name": name, "description": desc},
                          "competitors": [{"name": n, "description": d} for n, d in competitors]}, ensure_ascii=False)
    try:
        proc = subprocess.run(shlex.split(cmd), input=payload, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        fail(f"Fallo del juez externo: {exc}", 3)
    if proc.returncode != 0:
        fail(f"El juez externo terminó con código {proc.returncode}: {proc.stderr.strip()[:300]}", 3)
    out = proc.stdout.strip()
    try:
        value = json.loads(out)
        if isinstance(value, dict):
            value = value.get("activate")
    except json.JSONDecodeError:
        value = out.split()[0].lower() if out else ""
        value = {"true": True, "false": False}.get(value)
    if not isinstance(value, bool):
        fail(f"Respuesta del juez no interpretable: {out[:200]}", 3)
    return {"activated": value}


def metrics(rows, key):
    tp = sum(1 for r in rows if r["expected"] and r[key]["activated"])
    fn = sum(1 for r in rows if r["expected"] and not r[key]["activated"])
    tn = sum(1 for r in rows if not r["expected"] and not r[key]["activated"])
    fp = sum(1 for r in rows if not r["expected"] and r[key]["activated"])
    total = len(rows) or 1
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn,
            "accuracy": round((tp + tn) / total, 3),
            "precision": round(tp / (tp + fp), 3) if tp + fp else None,
            "recall": round(tp / (tp + fn), 3) if tp + fn else None}


def main():
    parser = argparse.ArgumentParser(description="Diff de enrutamiento de una skill antes/después.")
    parser.add_argument("--after", required=True, help="Carpeta de la versión nueva.")
    parser.add_argument("--before", help="Carpeta o respaldo .tar.gz de la versión anterior.")
    parser.add_argument("--cases", help="eval_cases.json (por defecto el de --after).")
    parser.add_argument("--catalog", help="Catálogo con las skills que compiten por el enrutado.")
    parser.add_argument("--threshold", type=float, default=0.25)
    parser.add_argument("--judge-cmd", help="Comando externo que decide la activación.")
    parser.add_argument("--judge-timeout", type=int, default=60)
    parser.add_argument("--fail-on-miss", action="store_true", help="Código 1 si la versión nueva falla algún caso.")
    args = parser.parse_args()

    after_name, after_desc = load_version(args.after)
    before = load_version(args.before) if args.before else None
    cases_path = Path(args.cases) if args.cases else Path(args.after) / "references" / "eval_cases.json"
    try:
        cases = json.loads(cases_path.read_text(encoding="utf-8"))["cases"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        fail(f"No se pueden leer los casos de {cases_path}: {exc}")
    competitors = load_catalog(args.catalog, after_name)

    def predict(prompt, name, desc):
        if args.judge_cmd:
            return predict_judge(args.judge_cmd, args.judge_timeout, prompt, name, desc, competitors)
        return predict_proxy(prompt, name, desc, competitors, args.threshold)

    rows = []
    for case in cases:
        row = {"id": case["id"], "expected": bool(case["expected_activation"]), "prompt": case["prompt"]}
        row["after"] = predict(case["prompt"], after_name, after_desc)
        row["after"]["correct"] = row["after"]["activated"] == row["expected"]
        if before:
            row["before"] = predict(case["prompt"], *before)
            row["before"]["correct"] = row["before"]["activated"] == row["expected"]
            if row["before"]["correct"] == row["after"]["correct"]:
                row["change"] = "same"
            else:
                row["change"] = "fixed" if row["after"]["correct"] else "regressed"
        rows.append(row)

    report = {
        "method": "external-judge" if args.judge_cmd else METHOD,
        "skill": after_name,
        "threshold": None if args.judge_cmd else args.threshold,
        "competitors": len(competitors),
        "after": metrics(rows, "after"),
        "cases": rows,
    }
    if before:
        report["before"] = metrics(rows, "before")
        report["regressed"] = [r["id"] for r in rows if r.get("change") == "regressed"]
        report["fixed"] = [r["id"] for r in rows if r.get("change") == "fixed"]
        report["description_changed"] = before[1] != after_desc
    report["misses_after"] = [r["id"] for r in rows if not r["after"]["correct"]]
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if before and report["regressed"]:
        sys.exit(1)
    if args.fail_on_miss and report["misses_after"]:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
