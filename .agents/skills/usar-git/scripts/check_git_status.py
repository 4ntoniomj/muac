#### `.agent/skills/flujo-git/scripts/check_git_status.py`

```python
#!/usr/bin/env python3
"""
Script determinista para verificar el estado de Git, la rama actual y
alertar sobre modificaciones no commiteadas o desincronizaciones con main/dev.
Devuelve JSON estructurado y códigos de retorno:
0 = OK / Limpio
1 = Hay cambios pendientes de commit/stash
2 = Error fatal o no es repositorio git
"""
import subprocess
import sys
import json

def run_git(args):
    result = subprocess.run(["git"] + args, capture_output=True, text=True)
    if result.returncode != 0:
        return None, result.stderr.strip()
    return result.stdout.strip(), None

def main():
    # 1. Comprobar si es un repositorio git
    branch_out, err = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if err:
        print(json.dumps({"status": "error", "message": "No es un repositorio Git válido", "error": err}))
        sys.exit(2)

    current_branch = branch_out

    # 2. Comprobar cambios sin commitear (porcelana)
    status_out, _ = run_git(["status", "--porcelain"])
    modified_files = [line.strip() for line in status_out.splitlines() if line.strip()]

    # 3. Comprobar ramas existentes
    branches_out, _ = run_git(["branch", "--list"])
    existing_branches = [b.replace("*", "").strip() for b in branches_out.splitlines()]

    response = {
        "status": "ok",
        "current_branch": current_branch,
        "is_main": current_branch == "main",
        "is_dev": current_branch == "dev",
        "has_uncommitted_changes": len(modified_files) > 0,
        "modified_count": len(modified_files),
        "modified_files": modified_files[:15],
        "branches_detected": existing_branches,
        "protection_alert": (
            "ATENCIÓN: Te encuentras en la rama 'main'. Está prohibido comitear o mergear sin autorización humana."
            if current_branch == "main" else None
        )
    }

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if len(modified_files) > 0:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()