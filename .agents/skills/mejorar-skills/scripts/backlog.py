#!/usr/bin/env python3
"""Gestiona references/backlog.md de una skill: mejoras y peticiones para aplicar en el futuro.

Uso:
  backlog.py add    --path <skill> --origen "<petición literal>" --propuesta "<cambio>" --condicion "<cuándo aplicarlo>"
                    [--estado aplicada]   (registra un cambio ya aplicado para dejar traza)
  backlog.py list   --path <skill> [--estado abierta|aplicada|descartada]
  backlog.py estado --path <skill> --id BL-003 --a aplicada|descartada --nota "<qué se hizo o por qué se descarta>"

Formato de cada entrada (lo comprueba validate_skill.py, W111):
  ## BL-NNN · abierta · AAAA-MM-DD
  - Origen: …
  - Propuesta: …
  - Condición para aplicarla: …
Salida JSON. Códigos: 0 correcto, 1 entrada inexistente o duplicada, 2 error de uso o E/S.
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

HEAD_RE = re.compile(r"^## (BL-\d{3}) · (abierta|aplicada|descartada) · (\d{4}-\d{2}-\d{2})\s*$")


def out(data, code=0):
    print(json.dumps(data, indent=2, ensure_ascii=False))
    sys.exit(code)


def load(path):
    skill = Path(path)
    if not (skill / "SKILL.md").is_file():
        out({"error": f"{skill} no es una skill (falta SKILL.md)."}, 2)
    backlog = skill / "references" / "backlog.md"
    if not backlog.is_file():
        backlog.parent.mkdir(parents=True, exist_ok=True)
        backlog.write_text(
            f"# Backlog de {skill.name}\n\n"
            "Mejoras futuras (abiertas) y cambios aplicados o descartados, registrados con `mejorar-skills/scripts/backlog.py`.\n"
            "Formato de entrada: `mejorar-skills/templates/backlog-entry.md`.\n",
            encoding="utf-8",
        )
    return backlog, backlog.read_text(encoding="utf-8").splitlines()


def parse(lines):
    entries, current = [], None
    for i, line in enumerate(lines):
        m = HEAD_RE.match(line)
        if m:
            current = {"id": m.group(1), "estado": m.group(2), "fecha": m.group(3), "line": i, "campos": {}}
            entries.append(current)
        elif line.startswith("## "):
            current = None
        elif current and line.startswith("- ") and ":" in line:
            key, _, value = line[2:].partition(":")
            current["campos"][key.strip()] = value.strip()
    return entries


def normalize(text):
    return re.sub(r"\s+", " ", text.lower()).strip()


def main():
    parser = argparse.ArgumentParser(description="Backlog de mejoras de una skill.")
    sub = parser.add_subparsers(dest="action", required=True)
    add = sub.add_parser("add")
    add.add_argument("--path", required=True)
    add.add_argument("--origen", required=True)
    add.add_argument("--propuesta", required=True)
    add.add_argument("--condicion", required=True)
    add.add_argument("--estado", choices=("abierta", "aplicada"), default="abierta")
    ls = sub.add_parser("list")
    ls.add_argument("--path", required=True)
    ls.add_argument("--estado", choices=("abierta", "aplicada", "descartada"))
    st = sub.add_parser("estado")
    st.add_argument("--path", required=True)
    st.add_argument("--id", required=True)
    st.add_argument("--a", required=True, choices=("aplicada", "descartada"))
    st.add_argument("--nota", required=True)
    args = parser.parse_args()

    backlog, lines = load(args.path)
    entries = parse(lines)

    if args.action == "list":
        found = [dict(e, line=e["line"] + 1) for e in entries if not args.estado or e["estado"] == args.estado]
        out({"backlog": str(backlog), "entries": found})

    if args.action == "add":
        for e in entries:
            if e["estado"] == "abierta" and normalize(e["campos"].get("Propuesta", "")) == normalize(args.propuesta):
                out({"error": f"Ya existe una entrada abierta con esa propuesta: {e['id']}."}, 1)
        next_id = max((int(e["id"][3:]) for e in entries), default=0) + 1
        entry_id = f"BL-{next_id:03d}"
        block = ["", f"## {entry_id} · {args.estado} · {date.today().isoformat()}", "",
                 f"- Origen: {args.origen}", f"- Propuesta: {args.propuesta}",
                 f"- Condición para aplicarla: {args.condicion}"]
        while lines and not lines[-1].strip():
            lines.pop()
        backlog.write_text("\n".join(lines + block) + "\n", encoding="utf-8")
        out({"added": entry_id, "backlog": str(backlog)})

    entry = next((e for e in entries if e["id"] == args.id), None)
    if not entry:
        out({"error": f"No existe {args.id} en {backlog}."}, 1)
    lines[entry["line"]] = f"## {entry['id']} · {args.a} · {entry['fecha']}"
    end = next((e["line"] for e in entries if e["line"] > entry["line"]), len(lines))
    while end > entry["line"] and not lines[end - 1].strip():
        end -= 1
    lines.insert(end, f"- Resolución ({date.today().isoformat()}): {args.nota}")
    backlog.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out({"updated": entry["id"], "estado": args.a, "backlog": str(backlog)})


if __name__ == "__main__":
    main()
