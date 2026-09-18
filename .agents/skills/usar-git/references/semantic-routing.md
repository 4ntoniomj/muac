# Enrutamiento Semántico y Fronteras (flujo-git)

Este documento define el criterio de activación y delimitación para el enrutador de agentes al evaluar si una petición debe delegarse a `flujo-git` o a otra skill del catálogo.

---

## 1. Intención principal

`flujo-git` gobierna la interacción local y remota con Git bajo la arquitectura de ramas:
- `main`: rama protegida de producción (estable).
- `dev`: rama base de integración (desarrollo).
- `feature/*`, `fix/*`, `refactor/*`, `docs/*`: ramas efímeras de trabajo.

---

## 2. Disparadores de Activación (Activar cuando...)

Activar cuando el usuario use términos y expresiones como:
- "Crea una rama para..."
- "Haz commit de los cambios / guarda este avance"
- "Pasa los cambios a dev / integra a desarrollo"
- "Promociona a main / pasa a producción"
- "Revisa el estado de git / mira si hay cambios sucios"
- "Deshaz este commit / descarta los cambios" *(con previa advertencia y confirmación socrática)*

---

## 3. Límites y Fronteras Negativas (No usar para...)

No activar `flujo-git` en los siguientes supuestos:

| Escenario | Skill o comportamiento adecuado |
| :--- | :--- |
| **Pipelines CI/CD** (GitHub Actions, GitLab CI, Jenkins, desplegar en AWS/GCP). | Delegar a skill de `ci-cd` o `devops`. |
| **Resolución autónoma de conflictos de código complejos** durante un merge o rebase. | Intervención asistida donde el modelo expone las diferencias y el usuario decide qué implementación conservar. |
| **Administración del sistema anfitrión** (backups de base de datos, configuración de servidores web, scripts cron). | Delegar a `sysadmin` o `bash-tools`. |
| **Diseño o implementación de código de negocio** ajeno al control de versiones. | Delegar a la skill de lenguaje o arquitectura respectiva (`fullstack`, `backend`, `frontend`). |

---

## 4. Reglas de Cortafuegos Interno

Aun estando activa la skill, aplican las siguientes reglas de parada forzosa:
1. **Destino `main`:** Si la acción final desemboca en `merge` o `push` hacia `main`, el agente debe detenerse, comprobar si el usuario ya validó en `dev` y solicitar autorización verbal antes de ejecutar.
2. **Acciones destructivas:** Flags como `--force`, `reset --hard` o `clean -fd` requieren obligatoriamente una explicación del impacto y confirmación explícita del usuario.