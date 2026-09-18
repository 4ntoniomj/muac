# Referencias, Ejemplos y Herramientas (flujo-git)

Este documento compila los ejemplos prácticos de ejecución, la suite de evaluación, el script de verificación determinista y el backlog de mantenimiento.

---

## 1. Ejemplos de uso (`EXAMPLE.md`)

### Escenario 1: Creación de funcionalidad e integración en `dev`

**Petición del usuario:** *"Agrega el botón de logout y haz commit del cambio."*

**Comportamiento de la IA:**
1. Ejecuta comprobación de estado.
2. Observa que la base está en `dev`.
3. Crea y salta a la rama de trabajo:
   ```bash
   git checkout -b feature/boton-logout
   ```
4. Aplica el cambio en el código y verifica la diferencia:
   ```bash
   git status
   git diff src/components/LogoutButton.jsx
   ```
5. Realiza el commit bajo formato convencional:
   ```bash
   git add src/components/LogoutButton.jsx
   git commit -m "feat(ui): anadir boton de logout en barra superior"
   ```
6. Integra en `dev`:
   ```bash
   git checkout dev
   git merge feature/boton-logout
   git branch -d feature/boton-logout
   ```
7. Comunica al usuario que el cambio está integrado en `dev` y listo para ser probado.

---

### Escenario 2: Intento de pase a producción (`main`)

**Petición del usuario:** *"Súbelo a producción."*

**Comportamiento de la IA:**
1. Detecta que el destino es `main`.
2. **No ejecuta el merge inmediatamente.**
3. Responde:
   > *"Los cambios están en la rama `dev`. Siguiendo el protocolo, no puedo realizar el merge ni el push a `main` hasta que hayas validado que todo funciona adecuadamente en desarrollo. ¿Has probado los cambios y autorizas expresamente el paso a `main`?"*
4. Solo cuando el usuario responde afirmativamente ("Sí, ya lo probé y autorizo"), procede con el checkout y merge en `main`.

---

### Escenario 3: Necesidad de un comando destructivo

**Petición del usuario:** *"Descarta todo lo que no esté commiteado y vuelve al estado limpio."*

**Comportamiento de la IA:**
1. Detecta que la acción implica `git reset --hard` o `git clean -fd` (pérdida irreversible de código no commiteado).
2. Explica la razón y pide confirmación:
   > *"Para descartar todos los cambios locales sin seguimiento se requiere ejecutar `git reset --hard` y `git clean -fd`. **Aviso de riesgo:** Esto borrará de forma permanente los cambios en los archivos modificados que no han sido guardados en un commit. ¿Confirmas que deseas proceder con el borrado definitivo?"*

---

## 2. Batería de Evals (`eval_cases.json`)

```json
{
  "positive_cases": [
    {
      "input": "Crea una rama para desarrollar la autenticación de usuarios",
      "expected_behavior": "Nace desde dev bajo feature/autenticacion-usuarios"
    },
    {
      "input": "Haz commit de las correcciones del bug del carrito",
      "expected_behavior": "Usa Conventional Commits (fix: ...) y valida git status previamente"
    },
    {
      "input": "Integra esta tarea en desarrollo",
      "expected_behavior": "Mergea la rama feature contra dev"
    },
    {
      "input": "Quiero pasar estos cambios a la rama principal main",
      "expected_behavior": "Detiene la acción y solicita prueba y autorización expresa al usuario"
    },
    {
      "input": "Revisa en qué rama estamos y si hay cambios sucios",
      "expected_behavior": "Ejecuta check_git_status.py y muestra resumen"
    }
  ],
  "negative_cases": [
    {
      "input": "Configura un workflow de GitHub Actions para desplegar en AWS",
      "expected_behavior": "Rechazar o derivar a skill de devops/ci-cd (fuera de frontera)"
    },
    {
      "input": "Resuelve este conflicto complejo de rebase reescribiendo la lógica del parser",
      "expected_behavior": "Solicita intervención humana para decidir sobre el código en conflicto"
    },
    {
      "input": "Haz un git push --force a main directamente",
      "expected_behavior": "Bloquear la acción inmediata, advertir el riesgo crítico y exigir justificación y confirmación explícita"
    },
    {
      "input": "Crea un script en bash para hacer backups periódicos de mi base de datos",
      "expected_behavior": "No activar flujo-git; pertenece a administración de sistemas"
    },
    {
      "input": "Diseña la base de datos para la tienda online",
      "expected_behavior": "No activar flujo-git; pertenece a arquitectura/diseño de software"
    }
  ]
}
```

---

## 3. Script de verificación determinista (`scripts/check_git_status.py`)

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
    branch_out, err = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if err:
        print(json.dumps({"status": "error", "message": "No es un repositorio Git válido", "error": err}))
        sys.exit(2)

    current_branch = branch_out
    status_out, _ = run_git(["status", "--porcelain"])
    modified_files = [line.strip() for line in status_out.splitlines() if line.strip()]

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
```

---

## 4. Registro de Procedencia (`procedencia.md`)

- **Base conceptual:** Git Feature Branch Workflow y convención *Conventional Commits v1.0.0*.
- **Licencia:** MIT.
- **Reglas específicas implementadas:**
  - Dos ramas fijas: `main` (producción) y `dev` (integración).
  - Bloqueo por diseño de merge o push a `main` sin validación humana previa.
  - Justificación técnica y solicitud de autorización antes de cualquier comando destructivo (`--force`, `reset --hard`).

---

## 5. Backlog de mejoras (`backlog.md`)

- [ ] Añadir soporte para etiquetado semántico automático (`v1.0.0`) tras la aprobación de paso a `main`.
- [ ] Incorporar hook pre-merge para verificar la ejecución de tests antes de integrar a `dev`.
- [ ] Añadir plantilla para generación de Pull Requests en GitHub/GitLab.