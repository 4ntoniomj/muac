#!/usr/bin/env python3
"""Busca skills instaladas en catálogos locales y las ordena por afinidad con una consulta.

Uso:
  find_skills.py --query "páginas web con buen diseño" [--catalog DIR ...] [--limit 10] [--deep]
  find_skills.py --name paginas-web --exact [--catalog DIR ...]

Sin --catalog revisa las rutas de DEFAULT_CATALOGS que existan (proyecto y usuario, para
Antigravity y Claude Code). Ignora carpetas *.backup.* y respaldos.
Puntuación léxica (nombre x3, description x1, cuerpo x0.2 con --deep): es un filtro previo,
la elección final se hace con la rúbrica de references/search-and-adaptation.md.
Salida JSON. Códigos: 0 = ejecución correcta (con o sin resultados), 2 = ningún catálogo existe.
"""

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from routing_score import load_skill, normalize, stems  # noqa: E402

DEFAULT_CATALOGS = [
    "./.agent/skills", "./.agents/skills", "./.claude/skills",
    "~/.gemini/config/skills", "~/.gemini/antigravity/skills", "~/.agents/skills", "~/.claude/skills",
]


def discover(catalogs):
    found = []
    for cat in catalogs:
        base = Path(cat).expanduser()
        if not base.is_dir():
            continue
        for skill_md in sorted(base.glob("*/SKILL.md")):
            if ".backup." not in skill_md.parent.name:
                found.append((str(base), skill_md.parent))
    return found


def main():
    parser = argparse.ArgumentParser(description="Busca skills en catálogos locales.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query", help="Necesidad del usuario en lenguaje natural.")
    mode.add_argument("--name", help="Nombre de skill a localizar.")
    parser.add_argument("--exact", action="store_true", help="Con --name: solo coincidencia exacta.")
    parser.add_argument("--catalog", action="append", help="Directorio de catálogo (repetible).")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--min-score", type=float, default=1.0)
    parser.add_argument("--deep", action="store_true", help="Incluye el cuerpo de SKILL.md en la puntuación.")
    args = parser.parse_args()

    catalogs = args.catalog or DEFAULT_CATALOGS
    existing = [str(Path(c).expanduser()) for c in catalogs if Path(c).expanduser().is_dir()]
    if not existing:
        print(json.dumps({"error": "Ningún catálogo existe.", "catalogs": catalogs}, ensure_ascii=False))
        sys.exit(2)

    terms = stems(args.query, expand=True) if args.query else set()
    results = []
    for catalog, skill_dir in discover(catalogs):
        name, desc, body = load_skill(skill_dir)
        if args.name:
            hit = name == args.name if args.exact else normalize(args.name) in normalize(name)
            if hit:
                results.append({"name": name, "path": str(skill_dir), "catalog": catalog, "score": None,
                                "description": desc[:240]})
            continue
        name_hits = terms & stems(name)
        desc_hits = terms & stems(desc)
        body_hits = terms & stems(body) if args.deep else set()
        score = 3 * len(name_hits) + len(desc_hits) + 0.2 * len(body_hits)
        if score >= args.min_score:
            results.append({
                "name": name, "path": str(skill_dir), "catalog": catalog, "score": round(score, 2),
                "matched": sorted(name_hits | desc_hits | body_hits),
                "description": desc[:240] + ("…" if len(desc) > 240 else ""),
            })

    results.sort(key=lambda r: (-(r["score"] or 0), r["name"], r["path"]))
    by_name = {}
    for r in results:
        by_name.setdefault(r["name"], []).append(r["path"])
    for r in results:
        r["same_name_in"] = [p for p in by_name[r["name"]] if p != r["path"]]

    print(json.dumps({
        "query": args.query, "name": args.name, "terms": sorted(terms),
        "catalogs_scanned": existing, "results": results[: args.limit],
    }, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
