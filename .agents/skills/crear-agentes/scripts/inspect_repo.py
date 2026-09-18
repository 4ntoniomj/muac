#!/usr/bin/env python3
"""Inspecciona un repositorio y propone qué carpetas merecen un AGENTS.md de subagente.

Uso:
  inspect_repo.py --root <repo> [--max-files 20000]

Detecta por archivos marcadores (package.json, pyproject.toml, Cargo.toml, go.mod…), cuenta
extensiones, extrae comandos declarados en manifiestos (scripts de package.json, objetivos de
Makefile, scripts de pyproject) y lista AGENTS.md / CLAUDE.md / GEMINI.md existentes y el
catálogo de skills. No ejecuta nada ni instala nada.
Cada comando lleva "source": solo los que tienen fuente en un manifiesto se pueden copiar a un
AGENTS.md sin verificar; los "convention" deben comprobarse antes.
Salida JSON. Códigos: 0 correcto, 2 error de uso.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import tomllib
except ImportError:  # Python < 3.11
    tomllib = None

IGNORED = {".git", "node_modules", "target", "dist", "build", ".venv", "venv", "__pycache__", ".next",
           ".cache", "coverage", ".agent", ".agents", ".claude", ".gemini", "vendor", "gen", ".idea", ".vscode",
           ".pytest_cache", ".mypy_cache", ".ruff_cache", "out", ".turbo", ".svelte-kit"}
LANG_BY_EXT = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
    ".py": "Python", ".ipynb": "Jupyter", ".rs": "Rust", ".go": "Go", ".java": "Java", ".kt": "Kotlin",
    ".swift": "Swift", ".rb": "Ruby", ".php": "PHP", ".cs": "C#", ".c": "C", ".h": "C", ".cpp": "C++",
    ".css": "CSS", ".scss": "CSS", ".html": "HTML", ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
    ".sql": "SQL", ".sh": "Shell", ".tf": "Terraform", ".md": "Markdown",
}
JS_FRAMEWORKS = ["react", "next", "vue", "nuxt", "svelte", "@sveltejs/kit", "astro", "vite", "tailwindcss",
                 "express", "fastify", "@nestjs/core", "electron", "@tauri-apps/api", "vitest", "jest",
                 "@playwright/test", "eslint", "typescript", "prisma", "drizzle-orm"]
PY_TOOLS = ["pytest", "ruff", "mypy", "black", "poetry", "uv", "django", "fastapi", "flask", "pandas",
            "numpy", "scikit-learn", "torch", "tensorflow", "jupyter", "polars", "pydantic"]


def lockfile_manager(directory):
    for lock, manager in (("pnpm-lock.yaml", "pnpm"), ("yarn.lock", "yarn"), ("bun.lockb", "bun"),
                          ("bun.lock", "bun"), ("package-lock.json", "npm")):
        if (directory / lock).is_file():
            return manager
    return None


def read_package_json(directory, root):
    data = json.loads((directory / "package.json").read_text(encoding="utf-8"))
    manager = lockfile_manager(directory) or lockfile_manager(root) or "npm"
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    run = "npm run" if manager == "npm" else f"{manager} run"
    return {
        "manifest": "package.json",
        "package_manager": manager,
        "frameworks": [f for f in JS_FRAMEWORKS if f in deps],
        "commands": [{"name": k, "command": f"{run} {k}", "raw": v, "source": "package.json"}
                     for k, v in data.get("scripts", {}).items()],
    }


def read_pyproject(directory):
    text = (directory / "pyproject.toml").read_text(encoding="utf-8")
    info = {"manifest": "pyproject.toml", "tools": [t for t in PY_TOOLS if re.search(rf"\b{re.escape(t)}\b", text)],
            "commands": []}
    if tomllib:
        try:
            data = tomllib.loads(text)
            scripts = data.get("project", {}).get("scripts", {}) or data.get("tool", {}).get("poetry", {}).get("scripts", {})
            info["commands"] += [{"name": k, "command": k, "raw": v, "source": "pyproject.toml"} for k, v in scripts.items()]
            info["tool_sections"] = sorted(data.get("tool", {}).keys())
        except tomllib.TOMLDecodeError as exc:
            info["parse_error"] = str(exc)
    return info


def read_makefile(directory):
    targets = []
    for line in (directory / "Makefile").read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)", line)
        if m and m.group(1) not in (".PHONY",):
            targets.append({"name": m.group(1), "command": f"make {m.group(1)}", "source": "Makefile"})
    return {"manifest": "Makefile", "commands": targets}


def read_cargo(directory):
    text = (directory / "Cargo.toml").read_text(encoding="utf-8")
    return {"manifest": "Cargo.toml", "tauri": "tauri" in text,
            "commands": [{"name": n, "command": f"cargo {n}", "source": "convention"} for n in ("build", "test", "clippy", "fmt --check")]}


def read_gomod(directory):
    first = (directory / "go.mod").read_text(encoding="utf-8").splitlines()[:1]
    return {"manifest": "go.mod", "module": first[0].replace("module", "").strip() if first else None,
            "commands": [{"name": n, "command": f"go {n} ./...", "source": "convention"} for n in ("build", "test", "vet")]}


def scan_manifests(directory, root):
    found = []
    readers = [("package.json", lambda: read_package_json(directory, root)), ("pyproject.toml", lambda: read_pyproject(directory)),
               ("Makefile", lambda: read_makefile(directory)), ("Cargo.toml", lambda: read_cargo(directory)),
               ("go.mod", lambda: read_gomod(directory))]
    for marker, reader in readers:
        if (directory / marker).is_file():
            try:
                found.append(reader())
            except (OSError, ValueError) as exc:
                found.append({"manifest": marker, "error": str(exc)})
    for extra in ("requirements.txt", "setup.py", "Dockerfile", "docker-compose.yml", "compose.yaml", "tsconfig.json"):
        if (directory / extra).is_file():
            found.append({"manifest": extra, "commands": []})
    return found


def count_languages(directory, budget):
    counts = Counter()
    stack = [directory]
    while stack and budget[0] > 0:
        current = stack.pop()
        try:
            entries = list(current.iterdir())
        except OSError:
            continue
        for entry in entries:
            if entry.is_symlink():
                continue
            if entry.is_dir():
                if entry.name not in IGNORED and not entry.name.startswith("."):
                    stack.append(entry)
            elif entry.suffix in LANG_BY_EXT:
                counts[LANG_BY_EXT[entry.suffix]] += 1
                budget[0] -= 1
    return dict(counts.most_common(6))


def suggest_template(manifests, languages):
    names = {m["manifest"] for m in manifests}
    langs = set(languages)
    if "Cargo.toml" in names or "go.mod" in names or langs & {"Rust", "Go"} and not langs & {"TypeScript", "Python"}:
        return "systems-go-rust"
    if names & {"pyproject.toml", "requirements.txt", "setup.py"} or langs & {"Python", "Jupyter"}:
        return "python-data-ml"
    if "package.json" in names or langs & {"TypeScript", "JavaScript"}:
        return "fullstack-ts"
    return None


def agent_files(directory):
    out = {}
    for name in ("AGENTS.md", "CLAUDE.md", "GEMINI.md"):
        p = directory / name
        if p.exists() or p.is_symlink():
            out[name] = {"symlink_to": str(p.readlink()) if p.is_symlink() else None,
                         "lines": len(p.read_text(encoding="utf-8", errors="replace").splitlines()) if p.exists() else None}
    return out


def main():
    parser = argparse.ArgumentParser(description="Inspecciona un repositorio para diseñar AGENTS.md.")
    parser.add_argument("--root", required=True)
    parser.add_argument("--max-files", type=int, default=20000)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(json.dumps({"error": f"No existe {root}"}, ensure_ascii=False))
        sys.exit(2)
    budget = [args.max_files]
    root_manifests = scan_manifests(root, root)

    candidates = []
    for d in sorted(p for p in root.iterdir() if p.is_dir() and not p.is_symlink()):
        if d.name in IGNORED or d.name.startswith("."):
            continue
        manifests = scan_manifests(d, root)
        languages = count_languages(d, budget)
        code_files = sum(n for lang, n in languages.items() if lang != "Markdown")
        inherits = None
        if not manifests and code_files and root_manifests and d.name in ("src", "app", "lib", "web", "frontend", "client"):
            inherits = "."
        if not manifests and code_files < 3:
            continue
        effective = manifests or (root_manifests if inherits else [])
        candidates.append({
            "path": d.name + "/",
            "languages": languages,
            "manifests": manifests,
            "inherits_manifests_from": inherits,
            "suggested_template": suggest_template(effective, languages),
            "agent_files": agent_files(d),
        })

    catalog = next((c for c in (root / ".agent" / "skills", root / ".agents" / "skills") if c.is_dir()), None)
    skills = sorted(p.parent.name for p in catalog.glob("*/SKILL.md")) if catalog else []
    print(json.dumps({
        "root": str(root),
        "greenfield": not candidates and not root_manifests,
        "root_manifests": root_manifests,
        "root_agent_files": agent_files(root),
        "candidates": candidates,
        "catalog": str(catalog) if catalog else None,
        "skills": skills,
        "files_budget_exhausted": budget[0] <= 0,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
