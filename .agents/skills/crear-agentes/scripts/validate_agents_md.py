#!/usr/bin/env python3
"""Auditor estático de AGENTS.md: presupuesto de contexto, cobertura, skills y estilo.

Uso:
  validate_agents_md.py --path AGENTS.md [--role root|sub|auto] [--repo-root DIR] [--catalog DIR] [--strict]
  validate_agents_md.py --tree <repo> [--catalog DIR] [--strict]
  validate_agents_md.py --path templates/fullstack-ts.md --role sub --allow-placeholders

Raíz (orquestador): máx. 300 líneas y 5000 tokens estimados; secciones para las 4 áreas
críticas (orquestación, redacción, verificación de código, seguridad); protocolo de skills
(crear-skills y mejorar-skills); enlaces a los AGENTS.md de subcarpeta (con --tree).
Subcarpeta (subagente): máx. 100 líneas y 1000 tokens; sección "## Skills" con nombres entre
comillas invertidas; mejorar-skills incluida; cada skill existe en el catálogo; ámbito,
verificación y prohibición de orquestar; sin reglas copiadas del raíz.
Estilo (ambos): antipatrones de redacción de LLM de references/writing-rules.md.

Tokens estimados = ceil(caracteres / 3.5), heurística conservadora para español; no es el
tokenizador de ningún modelo.
Salida JSON. En --strict las advertencias pasan a errores.
Códigos: 0 válido, 1 hallazgos bloqueantes, 2 error de uso.
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

LIMITS = {"root": (300, 5000), "sub": (100, 1000)}
IGNORED_DIRS = {".git", "node_modules", "target", "dist", "build", ".venv", "venv", ".agent", ".agents",
                ".claude", "vendor", "__pycache__", ".next", ".cache"}
AREAS = {
    "orquestación": r"orquest|coordinaci|subagente|delegaci",
    "redacción": r"redacci|escritura|comunicaci|tono",
    "verificación de código": r"verificaci|pruebas|tests?\b|calidad",
    "seguridad": r"seguridad|riesgo|destructiv|permisos",
}
INFLATED = re.compile(
    r"\b(definitiv[oa]s?|inquebrantables?|de vanguardia|revolucionari[oa]s?|potentes?|robust[oa]s?|premium|"
    r"excepcional(es)?|sin precedentes|de primer nivel|canónic[oa]s?|taxativ[oa]s?|inmutables?|milimétric[oa]s?|"
    r"exhaustiv[oa]s?|integral(es)?|seamless|cutting-edge|world-class)\b", re.IGNORECASE)
CONTRAST = re.compile(r"\bno (se trata|es) (de |solo |sólo |simplemente )?[^.\n]{1,80}?,? sino\b", re.IGNORECASE)
FILLER = re.compile(
    r"(nada contradice|es importante (destacar|señalar|tener en cuenta)|cabe (destacar|señalar)|en resumen,|"
    r"claro,|aquí tienes|con gusto|no dudes en|espero que|vamos a (ver|revisar)|¡)", re.IGNORECASE)
SHOUT = re.compile(r"\b(ALWAYS|NEVER|MUST|DEBE[NS]?|PROHIBID[OA]S?|OBLIGATORI[OA]S?|IMPORTANTE|NUNCA|SIEMPRE|CRÍTIC[OA])\b")


def issue(code, message, line=None):
    item = {"code": code, "message": message}
    if line:
        item["line"] = line
    return item


def strip_code(text):
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    return re.sub(r"^(```|~~~).*?^\1\s*$", blank, text, flags=re.DOTALL | re.MULTILINE)


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


def headings(text):
    return [(m.group(1).strip(), line_of(text, m.start())) for m in re.finditer(r"^#{2,3}\s+(.+)$", text, re.MULTILINE)]


def section(text, pattern):
    """Devuelve el cuerpo de la primera sección ##/### cuyo título casa con pattern."""
    ms = list(re.finditer(r"^(#{2,3})\s+(.+)$", text, re.MULTILINE))
    for i, m in enumerate(ms):
        title = re.sub(r"^[^\w]+", "", m.group(2)).strip()
        if re.search(pattern, title, re.IGNORECASE):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
            return text[m.end():end]
    return None


def strip_quoted(text):
    """Blanquea citas y código inline: los ejemplos de lo que se prohíbe no son infracciones."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    return re.sub(r'"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|`[^`\n]*`', blank, text)


def style_checks(text, warnings):
    clean = strip_quoted(strip_code(text))
    for m in INFLATED.finditer(clean):
        warnings.append(issue("L001", f"Adjetivo inflado: '{m.group(0)}'.", line_of(clean, m.start())))
    for m in CONTRAST.finditer(clean):
        warnings.append(issue("L002", "Contraste forzado 'no es X, sino Y'.", line_of(clean, m.start())))
    bullets = re.findall(r"^\s*(?:[-*]|\d+\.)\s+(.*)$", clean, re.MULTILINE)
    bold = [b for b in bullets if re.match(r"\*\*[^*]+\*\*\s*:?", b)]
    if len(bullets) >= 4 and len(bold) / len(bullets) > 0.5:
        warnings.append(issue("L003", f"{len(bold)} de {len(bullets)} viñetas empiezan con etiqueta en negrita."))
    shouts = SHOUT.findall(clean)
    if shouts:
        warnings.append(issue("L004", f"Imperativos en mayúsculas ({len(shouts)}): {', '.join(sorted(set(shouts)))}."))
    for m in FILLER.finditer(clean):
        warnings.append(issue("L006", f"Relleno o cortesía: '{m.group(0)}'.", line_of(clean, m.start())))
    if re.search(r"^```mermaid", text, re.MULTILINE):
        warnings.append(issue("L008", "Diagrama Mermaid en AGENTS.md: muévelo a documentación enlazada."))


def default_catalogs(repo_root):
    return [str(c) for c in (repo_root / ".agent" / "skills", repo_root / ".agents" / "skills") if c.is_dir()]


def audit(path, role, repo_root, catalogs, allow_placeholders, root_text=None, sub_paths=()):
    errors, warnings = [], []
    text = path.read_text(encoding="utf-8")
    lines = len(text.splitlines())
    tokens = math.ceil(len(text) / 3.5)
    max_lines, max_tokens = LIMITS[role]
    metrics = {"lines": lines, "chars": len(text), "tokens_est": tokens, "tokens_method": "ceil(chars/3.5)",
               "max_lines": max_lines, "max_tokens": max_tokens}
    prefix = "A" if role == "root" else "B"
    if lines > max_lines:
        errors.append(issue(f"{prefix}001", f"{lines} líneas; máximo {max_lines}."))
    if tokens > max_tokens:
        errors.append(issue(f"{prefix}002", f"~{tokens} tokens estimados; máximo {max_tokens}."))

    clean = strip_code(text)
    if not allow_placeholders:
        for m in re.finditer(r"\{\{[A-Z0-9_]+\}\}", clean):
            errors.append(issue("X006", f"Marcador sin rellenar: {m.group(0)}.", line_of(clean, m.start())))
    for m in re.finditer(r"(?<!!)\[[^\]\n]+\]\(([^)\s#]+)(?:#[^)]*)?\)", clean):
        target = m.group(1)
        if allow_placeholders or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE) or "{{" in target:
            continue
        if not (path.parent / target).exists():
            errors.append(issue("X005", f"Enlace roto: '{target}'.", line_of(clean, m.start())))

    heads = headings(clean)
    if role == "root":
        for area, pattern in AREAS.items():
            if not any(re.search(pattern, h, re.IGNORECASE) for h, _ in heads):
                errors.append(issue("A003", f"Falta una sección (## o ###) para el área crítica: {area}."))
        for skill in ("crear-skills", "mejorar-skills"):
            if skill not in text:
                warnings.append(issue("A007", f"El orquestador no menciona el protocolo de '{skill}'."))
        for sub in sub_paths:
            rel = str(sub.relative_to(path.parent))
            if rel not in text:
                errors.append(issue("A004", f"El raíz no referencia {rel}."))
    else:
        skills_body = section(clean, r"^skills\b|skills permitidas|skills disponibles")
        listed = []
        if skills_body is None:
            errors.append(issue("B010", "Falta la sección '## Skills' con la lista de skills del subagente."))
        else:
            listed = re.findall(
                r"^\s*(?:[-*]\s+|\|[^|\n]*\|\s*)`([a-z0-9]+(?:-[a-z0-9]+)*)`",
                skills_body, re.MULTILINE)
            if not listed:
                errors.append(issue("B010", "La sección Skills no lista skills entre comillas invertidas, ni en viñetas ni en filas de tabla."))
            if "mejorar-skills" not in listed:
                errors.append(issue("B011", "Falta 'mejorar-skills' en la lista de skills (debe estar siempre)."))
            if catalogs:
                for name in listed:
                    if not any((Path(c) / name / "SKILL.md").is_file() for c in catalogs):
                        errors.append(issue("B012", f"La skill '{name}' no existe en el catálogo; créala con crear-skills."))
            else:
                warnings.append(issue("B013", "No se encontró catálogo de skills; no se comprobó su existencia."))
        metrics["skills"] = listed
        if not any(re.search(r"ámbito|alcance|carpeta", h, re.IGNORECASE) for h, _ in heads):
            warnings.append(issue("B014", "Falta una sección de ámbito (qué carpeta gobierna el subagente)."))
        verify = section(clean, r"verificaci|comandos|pruebas")
        if verify is None or "`" not in verify:
            warnings.append(issue("B015", "Falta una sección de verificación con comandos entre comillas invertidas."))
        if not re.search(r"no (orquest|deleg)|sin (orquestar|delegar)", clean, re.IGNORECASE):
            warnings.append(issue("B016", "No indica que el subagente no orquesta ni delega."))
        if root_text:
            # Los bloques de código del raíz son plantillas de ejemplo, no reglas heredadas.
            root_lines = {re.sub(r"\s+", " ", l.strip().lower())
                          for l in strip_code(root_text).splitlines() if len(l.strip()) >= 30}
            dup = [l for l in text.splitlines() if re.sub(r"\s+", " ", l.strip().lower()) in root_lines]
            if len(dup) >= 3:
                warnings.append(issue("B017", f"{len(dup)} líneas copiadas del AGENTS.md raíz: se heredan, elimínalas."))

    style_checks(text, warnings)
    return {"path": str(path), "role": role, "metrics": metrics, "errors": errors, "warnings": warnings}


def finalize(result, strict):
    if strict and result["warnings"]:
        result["errors"] += result["warnings"]
        result["warnings"] = []
    result["valid"] = not result["errors"]
    return result


def main():
    parser = argparse.ArgumentParser(description="Auditor estático de AGENTS.md.")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--path", help="Un archivo AGENTS.md o plantilla.")
    target.add_argument("--tree", help="Repositorio: audita el AGENTS.md raíz y todos los de subcarpetas.")
    parser.add_argument("--role", choices=("root", "sub", "auto"), default="auto")
    parser.add_argument("--repo-root", help="Raíz del repositorio para --role auto (por defecto el directorio actual).")
    parser.add_argument("--catalog", action="append", help="Catálogo de skills (repetible).")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--allow-placeholders", action="store_true", help="Para auditar plantillas.")
    args = parser.parse_args()

    results = []
    if args.path:
        path = Path(args.path).resolve()
        if not path.is_file():
            print(json.dumps({"error": f"No existe {path}"}, ensure_ascii=False))
            sys.exit(2)
        repo = Path(args.repo_root).resolve() if args.repo_root else Path.cwd().resolve()
        role = args.role if args.role != "auto" else ("root" if path.parent == repo else "sub")
        catalogs = args.catalog or default_catalogs(repo)
        root_file = repo / "AGENTS.md"
        root_text = root_file.read_text(encoding="utf-8") if role == "sub" and root_file.is_file() else None
        results.append(finalize(audit(path, role, repo, catalogs, args.allow_placeholders, root_text), args.strict))
    else:
        repo = Path(args.tree).resolve()
        root_file = repo / "AGENTS.md"
        if not root_file.is_file():
            print(json.dumps({"error": f"No existe {root_file}"}, ensure_ascii=False))
            sys.exit(2)
        subs = []
        for p in sorted(repo.rglob("AGENTS.md")):
            rel_parts = p.relative_to(repo).parts
            if p != root_file and not any(part in IGNORED_DIRS for part in rel_parts):
                subs.append(p)
        catalogs = args.catalog or default_catalogs(repo)
        root_text = root_file.read_text(encoding="utf-8")
        results.append(finalize(audit(root_file, "root", repo, catalogs, args.allow_placeholders, sub_paths=subs), args.strict))
        for sub in subs:
            results.append(finalize(audit(sub, "sub", repo, catalogs, args.allow_placeholders, root_text), args.strict))

    valid = all(r["valid"] for r in results)
    print(json.dumps({"valid": valid, "strict": args.strict, "files": results}, indent=2, ensure_ascii=False))
    sys.exit(0 if valid else 1)


if __name__ == "__main__":
    main()
