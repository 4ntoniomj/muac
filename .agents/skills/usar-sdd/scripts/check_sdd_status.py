#!/usr/bin/env python3
"""Comprueba el estado de un cambio OpenSpec e identifica la fase actual de SDD.

Uso:
  check_sdd_status.py [--change <nombre>] [--root <ruta>]

Salida: JSON con la fase SDD, artefactos, progreso de tareas y subagente/skill recomendado.
Códigos de salida:
  0 = Estado identificado correctamente (fase lista para avanzar o completada).
  1 = Bloqueo o Human Gate pendiente (requiere acción del usuario o resolución de prerrequisito).
  2 = Error de uso o directorio OpenSpec no encontrado.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


def find_openspec_root(start_path: Path) -> Path | None:
    current = start_path.resolve()
    for parent in [current, *current.parents]:
        if (parent / "openspec").is_dir():
            return parent
    return None


def count_tasks(tasks_file: Path) -> tuple[int, int]:
    if not tasks_file.is_file():
        return 0, 0
    text = tasks_file.read_text(encoding="utf-8", errors="replace")
    total = 0
    completed = 0
    for line in text.splitlines():
        m = re.match(r"^\s*-\s*\[([ xX])\]", line)
        if m:
            total += 1
            if m.group(1).lower() == "x":
                completed += 1
    return total, completed


def inspect_change_dir(change_dir: Path) -> dict:
    has_meta = (change_dir / ".openspec.yaml").is_file() or (change_dir / ".openspec.yml").is_file()
    has_proposal = (change_dir / "proposal.md").is_file()
    has_design = (change_dir / "design.md").is_file()
    has_tasks = (change_dir / "tasks.md").is_file()
    specs_dir = change_dir / "specs"
    has_specs = specs_dir.is_dir() and any(specs_dir.glob("**/*.md"))

    total_tasks, completed_tasks = count_tasks(change_dir / "tasks.md")

    return {
        "exists": True,
        "path": str(change_dir),
        "metadata": has_meta,
        "proposal": has_proposal,
        "specs": has_specs,
        "design": has_design,
        "tasks": has_tasks,
        "tasks_total": total_tasks,
        "tasks_completed": completed_tasks,
    }


def main():
    parser = argparse.ArgumentParser(description="Comprueba el estado de un cambio OpenSpec para el ciclo SDD.")
    parser.add_argument("--change", "-c", help="Nombre del cambio OpenSpec en kebab-case.")
    parser.add_argument("--root", "-r", help="Ruta al proyecto con directorio openspec/.", default=".")
    args = parser.parse_args()

    root_path = Path(args.root)
    openspec_root = find_openspec_root(root_path)

    if not openspec_root:
        result = {
            "error": "No se encontró el directorio openspec/ en la ruta ni en sus directorios superiores.",
            "code": 2,
            "phase": "UNINITIALIZED",
            "recommended_action": "Ejecutar openspec init si el usuario autoriza inicializar OpenSpec.",
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(2)

    changes_dir = openspec_root / "openspec" / "changes"

    target_change = args.change
    if not target_change:
        active_changes = []
        if changes_dir.is_dir():
            for entry in sorted(changes_dir.iterdir()):
                if entry.is_dir() and not entry.name.startswith("."):
                    active_changes.append(entry.name)
        if not active_changes:
            result = {
                "openspec_root": str(openspec_root),
                "change": None,
                "active_changes": [],
                "phase": "PHASE_1_EXPLORE",
                "recommended_subagent": "Explorador",
                "recommended_skill": "openspec-explore",
                "next_action": "Invocar al subagente de exploración para analizar la petición o crear un cambio.",
            }
            print(json.dumps(result, indent=2, ensure_ascii=False))
            sys.exit(0)
        elif len(active_changes) == 1:
            target_change = active_changes[0]
        else:
            result = {
                "openspec_root": str(openspec_root),
                "change": None,
                "active_changes": active_changes,
                "message": "Existen múltiples cambios activos. Especifica uno con --change.",
                "phase": "AMBIGUOUS",
            }
            print(json.dumps(result, indent=2, ensure_ascii=False))
            sys.exit(1)

    change_dir = changes_dir / target_change
    if not change_dir.is_dir():
        result = {
            "openspec_root": str(openspec_root),
            "change": target_change,
            "exists": False,
            "phase": "PHASE_1_EXPLORE",
            "recommended_subagent": "Explorador",
            "recommended_skill": "openspec-explore",
            "next_action": f"Crear propuesta o explorar antes de generar el cambio {target_change}.",
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0)

    info = inspect_change_dir(change_dir)
    planning_done = info["proposal"] and info["specs"] and info["tasks"]

    if not planning_done:
        phase = "PHASE_2_PROPOSE"
        subagent = "Diseñador/Especificador"
        skill = "openspec-propose"
        action = "Invocar al subagente de propuesta para completar artefactos (proposal, specs, design, tasks)."
        exit_code = 0
    elif info["tasks_total"] > 0 and info["tasks_completed"] == 0:
        phase = "HUMAN_GATE"
        subagent = "Ninguno (Punto de control humano)"
        skill = "Ninguna (Pausa obligatoria)"
        action = "Detenerse. Presentar la especificación y lista de tareas al usuario para confirmación explícita."
        exit_code = 1
    elif info["tasks_total"] > 0 and info["tasks_completed"] < info["tasks_total"]:
        phase = "PHASE_3_APPLY"
        subagent = "Implementador"
        skill = "openspec-apply-change"
        action = f"Invocar al subagente implementador para avanzar tareas ({info["tasks_completed"]}/{info["tasks_total"]})."
        exit_code = 0
    elif info["tasks_total"] > 0 and info["tasks_completed"] == info["tasks_total"]:
        phase = "PHASE_4_VERIFY_ARCHIVE"
        subagent = "Verificador"
        skill = "openspec-archive-change"
        action = "Invocar al subagente verificador para validar tests y archivar el cambio."
        exit_code = 0
    else:
        phase = "PHASE_2_PROPOSE"
        subagent = "Diseñador/Especificador"
        skill = "openspec-propose"
        action = "Tareas no definidas o formato vacío. Completar tasks.md."
        exit_code = 1

    result = {
        "openspec_root": str(openspec_root),
        "change": target_change,
        "phase": phase,
        "planning_artifacts": {
            "proposal": info["proposal"],
            "specs": info["specs"],
            "design": info["design"],
            "tasks": info["tasks"],
        },
        "tasks": {
            "total": info["tasks_total"],
            "completed": info["tasks_completed"],
            "remaining": info["tasks_total"] - info["tasks_completed"],
        },
        "recommended_subagent": subagent,
        "recommended_skill": skill,
        "next_action": action,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
