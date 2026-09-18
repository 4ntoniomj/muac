#!/usr/bin/env python3
"""Linter estático de skills (formato Agent Skills + convenciones del catálogo).

Uso:
  validate_skill.py --path .agent/skills/<nombre> [--strict] [--text]
  validate_skill.py --catalog .agent/skills [--strict] [--text]

Salida: JSON por defecto (--text para lectura humana).
Códigos de salida: 0 = válida, 1 = inválida, 2 = error de uso.
En --strict todas las advertencias se promueven a errores.
Solo biblioteca estándar de Python 3.10+.
"""

import argparse
import ast
import json
import os
import re
import sys
from pathlib import Path

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
NAME_MAX = 64
DESC_MAX = 1024
DESC_MIN = 80
BODY_MAX_LINES = 500
BACKLOG_RE = re.compile(r"^## BL-\d{3} · (abierta|aplicada|descartada) · \d{4}-\d{2}-\d{2}\s*$")
ALLOWED_KEYS = {"name", "description", "license", "compatibility", "allowed-tools", "metadata"}
REQUIRED_DIRS = ("scripts", "templates", "references")

# (clave, etiqueta, patrón de encabezado)
CANONICAL_SECTIONS = [
    ("contexto", "Contexto y Objetivo", r"contexto|objetivo"),
    ("flujo", "Tarea o Flujo de trabajo", r"tarea|flujo de trabajo|procedimiento"),
    ("salida", "Formato de salida", r"formato de salida|salida|entregable"),
    ("restricciones", "Restricciones y reglas", r"restricciones|reglas"),
    ("ejemplos", "Ejemplos (enlace a EXAMPLE.md)", r"ejemplo"),
]

POSITIVE_CUES = ("activar cuando", "usar cuando", "úsala cuando", "usala cuando", "use when", "activar si", "activar al", "activar para")
NEGATIVE_CUES = ("no usar", "no activar", "no la uses", "do not use", "don't use")

INFLATED = re.compile(
    r"\b(definitiv[oa]s?|revolucionari[oa]s?|de vanguardia|potent[ei]s?|increíbles?|"
    r"sin precedentes|el mejor del mundo|a la perfección|cutting-edge|seamless|game-changer)\b",
    re.IGNORECASE,
)


def issue(code, message, file=None, line=None):
    item = {"code": code, "message": message}
    if file:
        item["file"] = file
    if line:
        item["line"] = line
    return item


def strip_code(text):
    """Sustituye bloques de código y código inline por espacios conservando saltos de línea."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    text = re.sub(r"^(```|~~~).*?^\1\s*$", blank, text, flags=re.DOTALL | re.MULTILINE)
    return re.sub(r"`[^`\n]*`", blank, text)


def split_frontmatter(content):
    m = re.match(r"^---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)", content, re.DOTALL)
    if not m:
        return None, content, 0
    offset = content[: m.end()].count("\n")
    return m.group(1), content[m.end():], offset


def parse_frontmatter(raw):
    """Parser YAML mínimo: claves de primer nivel, escalares, bloques > | y mapas anidados simples."""
    data, errors = {}, []
    key, mode, buf = None, None, []

    def flush():
        if key is None:
            return
        if mode == "block_folded":
            data[key] = " ".join(s.strip() for s in buf if s.strip())
        elif mode == "block_literal":
            data[key] = "\n".join(s.strip() for s in buf).strip()
        elif mode == "map":
            data[key] = {k.strip(): v.strip().strip("\"'") for k, _, v in (s.strip().partition(":") for s in buf if s.strip())}

    for n, line in enumerate(raw.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            if mode in ("block_folded", "block_literal"):
                buf.append("")
            continue
        top = re.match(r"^([A-Za-z0-9_-]+):(?:\s+(.*))?$", line)
        if top and not line.startswith((" ", "\t")):
            flush()
            key, value, buf = top.group(1), (top.group(2) or "").strip(), []
            if key in data:
                errors.append(f"Clave duplicada en frontmatter: '{key}' (línea {n}).")
            if value in (">", ">-", ">+"):
                mode = "block_folded"
            elif value in ("|", "|-", "|+"):
                mode = "block_literal"
            elif value == "":
                mode = "map"
            else:
                mode = None
                if value[:1] in "\"'":
                    if len(value) < 2 or value[-1] != value[0]:
                        errors.append(f"Comillas sin cerrar en '{key}' (línea {n}).")
                    value = value[1:-1]
                data[key] = value
        elif key is not None and mode is not None:
            buf.append(line)
        else:
            errors.append(f"Línea de frontmatter no interpretable (línea {n}): {line.strip()[:60]}")
    flush()
    return data, errors


def check_links(path, root, rel_name, errors):
    text = path.read_text(encoding="utf-8")
    clean = strip_code(text)
    for m in re.finditer(r"(?<!!)\[[^\]\n]+\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", clean):
        target = m.group(1).split("#", 1)[0]
        if not target or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE):
            continue
        line = clean[: m.start()].count("\n") + 1
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            errors.append(issue("E120", f"Enlace relativo roto: '{target}'.", rel_name, line))
        else:
            try:
                resolved.relative_to(root.resolve())
            except ValueError:
                errors.append(issue("E121", f"El enlace '{target}' sale del directorio de la skill.", rel_name, line))


def check_scripts(skill_dir, errors, warnings, metrics):
    scripts = skill_dir / "scripts"
    if not scripts.is_dir():
        return 0
    local_modules = {p.stem for p in scripts.glob("*.py")}
    # Módulos de otras skills del mismo catálogo: dependencia interna permitida, pero declarada.
    sibling_modules = {p.stem: p.parent.parent.name for p in skill_dir.resolve().parent.glob("*/scripts/*.py")
                       if p.parent.parent.name != skill_dir.resolve().name}
    cross = set()
    stdlib = set(getattr(sys, "stdlib_module_names", ())) | {"__future__"}
    count = 0
    for item in sorted(scripts.rglob("*")):
        if not item.is_file() or item.name.startswith(".") or "__pycache__" in item.parts:
            continue
        count += 1
        rel = str(item.relative_to(skill_dir))
        with open(item, "rb") as fh:
            first = fh.readline()
        if not first.startswith(b"#!"):
            errors.append(issue("E130", "Falta la cabecera shebang (#!).", rel))
        if not os.access(item, os.X_OK):
            errors.append(issue("E131", "Sin permiso de ejecución (chmod +x).", rel))
        if item.suffix == ".py":
            if b"python3" not in first:
                warnings.append(issue("W132", "El shebang no invoca python3.", rel))
            try:
                tree = ast.parse(item.read_text(encoding="utf-8"), filename=rel)
            except SyntaxError as exc:
                errors.append(issue("E133", f"Error de sintaxis: {exc.msg}.", rel, exc.lineno))
                continue
            if not stdlib:
                continue
            for node in ast.walk(tree):
                names = []
                if isinstance(node, ast.Import):
                    names = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    names = [node.module]
                for name in names:
                    top = name.split(".")[0]
                    if top in stdlib or top in local_modules:
                        continue
                    if top in sibling_modules:
                        cross.add(f"{sibling_modules[top]}/scripts/{top}.py")
                    else:
                        errors.append(issue("E134", f"Dependencia de terceros no permitida: '{top}'.", rel, node.lineno))
    if cross:
        metrics["cross_skill_imports"] = sorted(cross)
    return count


def check_references(skill_dir, skill_text, warnings):
    refs = skill_dir / "references"
    if not refs.is_dir():
        return
    for md in sorted(refs.glob("*.md")):
        rel = str(md.relative_to(skill_dir))
        if rel not in skill_text and md.name not in skill_text:
            warnings.append(issue("W108", "Archivo de references/ no citado desde SKILL.md (nadie lo cargará).", rel))
        text = md.read_text(encoding="utf-8")
        if text.count("\n") > 100 and not re.search(r"^#{1,3}\s+(índice|indice|contenido)", text, re.IGNORECASE | re.MULTILINE):
            warnings.append(issue("W109", "Referencia de más de 100 líneas sin índice al principio.", rel))
    backlog = refs / "backlog.md"
    if backlog.is_file():
        for n, line in enumerate(backlog.read_text(encoding="utf-8").splitlines(), 1):
            if line.startswith("## ") and not BACKLOG_RE.match(line):
                warnings.append(issue("W111", "Entrada de backlog mal formada (## BL-NNN · abierta|aplicada|descartada · AAAA-MM-DD).", "references/backlog.md", n))
    for item in sorted(skill_dir.rglob("*")):
        if re.search(r"\.(backup|bak|orig)(\.|$)", item.name):
            warnings.append(issue("W107", "Respaldo dentro de la skill; muévelo a .agent/backups/.", str(item.relative_to(skill_dir))))


def check_evals(skill_dir, errors, warnings):
    path = skill_dir / "references" / "eval_cases.json"
    rel = "references/eval_cases.json"
    if not path.is_file():
        warnings.append(issue("W140", "Falta references/eval_cases.json (10 casos: 5 positivos y 5 negativos).", rel))
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(issue("E141", f"JSON inválido: {exc.msg}.", rel, exc.lineno))
        return None
    cases = data.get("cases") if isinstance(data, dict) else None
    if not isinstance(cases, list):
        errors.append(issue("E142", "Se esperaba un objeto con la lista 'cases'.", rel))
        return None
    if data.get("skill") != skill_dir.resolve().name:
        errors.append(issue("E143", f"'skill' ({data.get('skill')!r}) no coincide con la carpeta.", rel))
    pos = neg = 0
    ids = set()
    for i, case in enumerate(cases):
        cid = case.get("id", f"#{i}") if isinstance(case, dict) else f"#{i}"
        if not isinstance(case, dict):
            errors.append(issue("E144", f"Caso {cid}: no es un objeto.", rel))
            continue
        for field in ("id", "type", "prompt", "expected_activation", "rationale"):
            if field not in case:
                errors.append(issue("E144", f"Caso {cid}: falta el campo '{field}'.", rel))
        if cid in ids:
            errors.append(issue("E145", f"Id de caso duplicado: {cid}.", rel))
        ids.add(cid)
        ctype, expected = case.get("type"), case.get("expected_activation")
        if ctype not in ("positive", "negative"):
            errors.append(issue("E146", f"Caso {cid}: 'type' debe ser positive o negative.", rel))
        elif expected is not (ctype == "positive"):
            errors.append(issue("E147", f"Caso {cid}: expected_activation no concuerda con type.", rel))
        pos += ctype == "positive"
        neg += ctype == "negative"
        prompt = str(case.get("prompt", ""))
        if len(prompt.strip()) < 15 or re.search(r"TODO|<[^>]+>|\{\{", prompt):
            errors.append(issue("E148", f"Caso {cid}: prompt vacío o con marcadores sin rellenar.", rel))
    if pos < 5 or neg < 5:
        warnings.append(issue("W149", f"Se requieren al menos 5 positivos y 5 negativos (hay {pos}/{neg}).", rel))
    return {"positive": pos, "negative": neg}


def validate_skill(skill_dir, strict=False, max_lines=BODY_MAX_LINES):
    skill_dir = Path(skill_dir)
    errors, warnings, metrics = [], [], {}
    result = {"skill": skill_dir.name, "path": str(skill_dir), "strict": strict}
    if not skill_dir.is_dir():
        errors.append(issue("E001", "El directorio no existe."))
        return finalize(result, errors, warnings, metrics, strict)
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        errors.append(issue("E002", "Falta SKILL.md en la raíz de la skill."))
        return finalize(result, errors, warnings, metrics, strict)

    content = skill_md.read_text(encoding="utf-8")
    if re.search(r"[​-‏⁠﻿]", content):
        warnings.append(issue("W010", "SKILL.md contiene caracteres Unicode invisibles.", "SKILL.md"))
    raw, body, offset = split_frontmatter(content)
    if raw is None:
        errors.append(issue("E010", "No hay frontmatter YAML delimitado por '---' al inicio.", "SKILL.md"))
        return finalize(result, errors, warnings, metrics, strict)
    fm, fm_errors = parse_frontmatter(raw)
    errors.extend(issue("E011", e, "SKILL.md") for e in fm_errors)
    for key in sorted(set(fm) - ALLOWED_KEYS):
        warnings.append(issue("W012", f"Clave de frontmatter fuera de la especificación: '{key}' (muévela a metadata).", "SKILL.md"))

    name, desc = fm.get("name"), fm.get("description")
    folder = skill_dir.resolve().name
    if not name:
        errors.append(issue("E020", "Falta 'name' en el frontmatter.", "SKILL.md"))
    else:
        if not NAME_RE.match(name) or len(name) > NAME_MAX:
            errors.append(issue("E021", f"'name' debe ser kebab-case (a-z, 0-9, guiones simples) y <= {NAME_MAX} caracteres.", "SKILL.md"))
        if name != folder:
            errors.append(issue("E022", f"'name' ({name}) no coincide con la carpeta ({folder}).", "SKILL.md"))
        if re.search(r"anthropic|claude", name):
            warnings.append(issue("W023", "'name' contiene una palabra reservada (anthropic, claude).", "SKILL.md"))
    if not desc:
        errors.append(issue("E030", "Falta 'description' en el frontmatter.", "SKILL.md"))
        desc = ""
    else:
        if len(desc) > DESC_MAX:
            errors.append(issue("E031", f"'description' supera {DESC_MAX} caracteres ({len(desc)}).", "SKILL.md"))
        if len(desc) < DESC_MIN:
            warnings.append(issue("W032", f"'description' muy corta ({len(desc)} caracteres): riesgo de falsos negativos.", "SKILL.md"))
        low = desc.lower()
        if not any(c in low for c in POSITIVE_CUES):
            warnings.append(issue("W033", "La description no declara cuándo activarse ('Activar cuando…').", "SKILL.md"))
        if not any(c in low for c in NEGATIVE_CUES):
            warnings.append(issue("W034", "La description no declara exclusiones ('No usar para…').", "SKILL.md"))
        if re.search(r"<[A-Za-z/][^>]*>", desc):
            warnings.append(issue("W036", "La description contiene etiquetas tipo XML.", "SKILL.md"))
        if re.search(r"\b(yo|te ayudaré|puedo ayudarte|I can|I will)\b", desc, re.IGNORECASE):
            warnings.append(issue("W035", "La description debe ir en tercera persona.", "SKILL.md"))

    body_lines = body.count("\n") + 1
    metrics.update({"name": name, "description_chars": len(desc), "body_lines": body_lines})
    if body_lines > max_lines:
        errors.append(issue("E040", f"El cuerpo de SKILL.md supera {max_lines} líneas ({body_lines}); mueve detalle a references/.", "SKILL.md"))

    headings = [m.group(2).strip() for m in re.finditer(r"^(#{2,3})\s+(.+)$", strip_code(body), re.MULTILINE)]
    found = []
    for key, label, pattern in CANONICAL_SECTIONS:
        if any(re.search(pattern, h, re.IGNORECASE) for h in headings):
            found.append(key)
        else:
            warnings.append(issue("W050", f"Falta la sección canónica '{label}' (encabezado ## o ###).", "SKILL.md"))
    metrics["canonical_sections"] = found

    placeholders = re.findall(r"\{\{[A-Z0-9_]+\}\}", strip_code(body))
    if placeholders:
        warnings.append(issue("W060", f"Marcadores sin reemplazar: {', '.join(sorted(set(placeholders)))}.", "SKILL.md"))
    for m in INFLATED.finditer(strip_code(body)):
        warnings.append(issue("W061", f"Adjetivo inflado: '{m.group(0)}'.", "SKILL.md", body[: m.start()].count("\n") + offset + 1))

    example = skill_dir / "EXAMPLE.md"
    if not example.is_file():
        errors.append(issue("E070", "Falta EXAMPLE.md."))
    elif not re.search(r"\]\((?:\./)?EXAMPLE\.md(?:#[^)]*)?\)", strip_code(body)):
        warnings.append(issue("W071", "SKILL.md no enlaza a EXAMPLE.md con un enlace markdown.", "SKILL.md"))

    for d in REQUIRED_DIRS:
        if not (skill_dir / d).is_dir():
            warnings.append(issue("W080", f"Falta el directorio {d}/."))

    md_files = [skill_md] + ([example] if example.is_file() else [])
    if (skill_dir / "references").is_dir():
        md_files += sorted((skill_dir / "references").rglob("*.md"))
    for md in md_files:
        check_links(md, skill_dir, str(md.relative_to(skill_dir)), errors)

    check_references(skill_dir, content, warnings)
    metrics["scripts"] = check_scripts(skill_dir, errors, warnings, metrics)
    metrics["eval_cases"] = check_evals(skill_dir, errors, warnings)
    return finalize(result, errors, warnings, metrics, strict)


def finalize(result, errors, warnings, metrics, strict):
    if strict and warnings:
        errors = errors + [dict(w, code="S" + w["code"][1:]) for w in warnings]
        warnings = []
    result.update({"valid": not errors, "errors": errors, "warnings": warnings, "metrics": metrics})
    return result


def as_text(result):
    lines = [f"{'VÁLIDA' if result['valid'] else 'INVÁLIDA'}: {result['path']}"]
    for kind in ("errors", "warnings"):
        for it in result[kind]:
            loc = it.get("file", "")
            if it.get("line"):
                loc += f":{it['line']}"
            lines.append(f"  [{it['code']}] {loc} {it['message']}".rstrip())
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Linter estático de skills.")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--path", help="Directorio de una skill.")
    target.add_argument("--catalog", help="Directorio con varias skills (valida cada subcarpeta con SKILL.md).")
    parser.add_argument("--strict", action="store_true", help="Promueve advertencias a errores.")
    parser.add_argument("--text", action="store_true", help="Salida legible en lugar de JSON.")
    parser.add_argument("--max-lines", type=int, default=BODY_MAX_LINES, help="Máximo de líneas del cuerpo de SKILL.md.")
    args = parser.parse_args()

    if args.path:
        results = [validate_skill(args.path, args.strict, args.max_lines)]
    else:
        catalog = Path(args.catalog)
        if not catalog.is_dir():
            print(json.dumps({"error": f"No existe el catálogo: {catalog}"}, ensure_ascii=False))
            sys.exit(2)
        results = [validate_skill(p.parent, args.strict, args.max_lines)
                   for p in sorted(catalog.glob("*/SKILL.md")) if ".backup." not in p.parent.name]
        for r in results:
            dup = [x["path"] for x in results if x is not r and x.get("metrics", {}).get("name") == r.get("metrics", {}).get("name") and r.get("metrics", {}).get("name")]
            if dup:
                r["errors"].append(issue("E016", f"'name' duplicado en el catálogo: {', '.join(dup)}."))
                r["valid"] = False

    if args.text:
        print("\n".join(as_text(r) for r in results))
    else:
        payload = results[0] if args.path else {"valid": all(r["valid"] for r in results), "skills": results}
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    sys.exit(0 if all(r["valid"] for r in results) else 1)


if __name__ == "__main__":
    main()
