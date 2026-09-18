#!/usr/bin/env python3
"""Lista los ejecutables citados en los bloques de código de una skill y comprueba si están en PATH.

Uso:
  check_commands.py --path .agent/skills/<skill> [--include-templates]

Revisa bloques ```bash / sh / shell / zsh / console de SKILL.md, EXAMPLE.md y references/*.md.
Nunca ejecuta los comandos: solo busca el binario con shutil.which. Que un binario exista no
prueba que un flag exista; los flags se verifican después con `<binario> --help`.
Salida JSON. Códigos: 0 todos encontrados, 1 alguno ausente, 2 error de uso.
"""

import argparse
import json
import re
import shlex
import shutil
import sys
from pathlib import Path

SHELL_LANGS = {"bash", "sh", "shell", "zsh", "console"}
BUILTINS = set("""
cd echo export if then else elif fi for while do done case esac test [ [[ set unset source . exit
true false read local return function printf pwd alias type command trap shift wait eval exec
""".split())
FENCE_RE = re.compile(r"^(```|~~~)\s*([A-Za-z0-9_+-]*)[^\n]*\n(.*?)^\1\s*$", re.DOTALL | re.MULTILINE)


def commands_in(block):
    joined = re.sub(r"\\\n", " ", block)
    for offset, raw in enumerate(joined.splitlines()):
        line = raw.strip()
        if line.startswith("$ "):
            line = line[2:]
        if not line or line.startswith("#"):
            continue
        for segment in re.split(r"&&|\|\||[|;]|\$\(|`", line):
            try:
                tokens = shlex.split(segment, comments=True)
            except ValueError:
                tokens = segment.split()
            while tokens and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]):
                tokens.pop(0)
            if tokens and tokens[0] in ("sudo", "timeout", "time", "env", "nohup"):
                tokens = [t for t in tokens[1:] if not re.match(r"^(-|\d)", t)] or tokens
            if not tokens:
                continue
            cmd = tokens[0]
            if cmd in BUILTINS or re.search(r"[<>{}()$*]", cmd) or cmd.startswith(("-", ")")):
                continue
            yield offset, cmd


def main():
    parser = argparse.ArgumentParser(description="Comprueba si los ejecutables citados existen en PATH.")
    parser.add_argument("--path", required=True)
    parser.add_argument("--include-templates", action="store_true")
    args = parser.parse_args()

    skill = Path(args.path)
    if not (skill / "SKILL.md").is_file():
        print(json.dumps({"error": f"{skill} no es una skill."}, ensure_ascii=False))
        sys.exit(2)
    files = [skill / "SKILL.md", skill / "EXAMPLE.md"] + sorted((skill / "references").glob("*.md"))
    if args.include_templates:
        files += sorted((skill / "templates").glob("*.md"))

    found = {}
    for f in files:
        if not f.is_file():
            continue
        text = f.read_text(encoding="utf-8")
        for m in FENCE_RE.finditer(text):
            if m.group(2).lower() not in SHELL_LANGS:
                continue
            start = text[: m.start(3)].count("\n") + 1
            for offset, cmd in commands_in(m.group(3)):
                if cmd.startswith(("./", "../", "/")) or cmd.endswith((".py", ".sh")):
                    kind = "path"
                    ok = (skill / cmd).exists() or Path(cmd).exists()
                else:
                    kind = "binary"
                    ok = shutil.which(cmd) is not None
                key = (cmd, kind)
                item = found.setdefault(key, {"command": cmd, "kind": kind, "available": ok, "locations": []})
                item["locations"].append(f"{f.relative_to(skill)}:{start + offset}")

    results = sorted(found.values(), key=lambda r: (r["available"], r["command"]))
    missing = [r["command"] for r in results if not r["available"]]
    print(json.dumps({"skill": skill.name, "commands": results, "missing": missing,
                      "note": "Existencia del binario verificada; los flags se comprueban con --help."},
                     indent=2, ensure_ascii=False))
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()
