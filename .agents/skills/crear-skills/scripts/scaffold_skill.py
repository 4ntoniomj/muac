#!/usr/bin/env python3
"""Crea el esqueleto de una skill nueva a partir de una plantilla de templates/.

Uso:
  scaffold_skill.py --name paginas-web --template procedural-runbook --root .agent/skills [--dry-run]
  scaffold_skill.py --name paginas-web --template script-wrapper --root /tmp/borrador

Plantillas: procedural-runbook, script-wrapper, reference-architecture.
Nunca sobrescribe: si el destino existe sale con código 1.
Genera SKILL.md, EXAMPLE.md, scripts/, templates/, references/eval_cases.json y
references/backlog.md con marcadores que validate_skill.py --strict detecta hasta rellenarlos.
Salida JSON. Códigos: 0 = creado (o simulado), 1 = destino existente, 2 = error de uso.
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATES = HERE.parent / "templates"
CHOICES = ("procedural-runbook", "script-wrapper", "reference-architecture")


def eval_skeleton(name):
    cases = []
    for kind, n in (("positive", 5), ("negative", 5)):
        for i in range(1, n + 1):
            cases.append({
                "id": f"{kind[:3]}_{i:02d}",
                "type": kind,
                "prompt": "TODO",
                "expected_activation": kind == "positive",
                "rationale": "TODO",
            })
    return {"skill": name, "version": "0.1.0", "cases": cases}


def main():
    parser = argparse.ArgumentParser(description="Crea el esqueleto de una skill.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--template", required=True, choices=CHOICES)
    parser.add_argument("--root", required=True, help="Directorio donde se creará <name>/.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", args.name) or len(args.name) > 64:
        print(json.dumps({"error": "name debe ser kebab-case y <= 64 caracteres."}, ensure_ascii=False))
        sys.exit(2)
    target = Path(args.root) / args.name
    if target.exists():
        print(json.dumps({"error": f"El destino ya existe: {target}. Usa mejorar-skills para modificarlo."}, ensure_ascii=False))
        sys.exit(1)

    template = (TEMPLATES / f"{args.template}.md").read_text(encoding="utf-8")
    skill_md = template.replace("{{NOMBRE_SKILL}}", args.name)
    example = (TEMPLATES / "example.md").read_text(encoding="utf-8").replace("{{NOMBRE_SKILL}}", args.name)
    backlog = (
        f"# Backlog de {args.name}\n\n"
        "Mejoras futuras (abiertas) y cambios aplicados o descartados, registrados con mejorar-skills/scripts/backlog.py.\n"
        "Formato de entrada: ver mejorar-skills/templates/backlog-entry.md.\n"
    )
    files = {
        "SKILL.md": skill_md,
        "EXAMPLE.md": example,
        "references/eval_cases.json": json.dumps(eval_skeleton(args.name), indent=2, ensure_ascii=False) + "\n",
        "references/backlog.md": backlog,
        "scripts/.gitkeep": "",
        "templates/.gitkeep": "",
    }
    if not args.dry_run:
        for rel, content in files.items():
            path = target / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    print(json.dumps({
        "created": not args.dry_run, "path": str(target), "template": args.template,
        "files": sorted(files), "date": date.today().isoformat(),
        "next": f"Rellena los marcadores {{{{...}}}} y TODO, y ejecuta validate_skill.py --path {target} --strict",
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
