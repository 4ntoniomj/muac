---
name: flujo-git
description: >-
  Gestiona el control de versiones con Git siguiendo el flujo de dos ramas fijas: main
  (estable/producción) y dev (desarrollo e integración). Gobierna la creación de ramas
  efímeras (feature/*, fix/*), commits bajo Conventional Commits, y el bloqueo estricto
  de merges a main hasta recibir autorización expresa tras pruebas del usuario.
  Activar cuando el usuario pida gestionar ramas, hacer commits, integrar cambios a desarrollo,
  revisar el estado del repositorio o preparar lanzamientos a producción. No usar para
  crear pipelines de CI/CD (GitHub Actions/GitLab CI) ni para ejecutar reescrituras
  destructivas de historial sin justificación previa y autorización.
metadata:
  version: "1.0.0"
---

# flujo-git

## Contexto y reglas fundamentales

Este repositorio sigue un modelo estricto de dos ramas permanentes:
1. **`main`**: Versión estable y lista para producción.
2. **`dev`**: Versión activa de desarrollo donde se integra el trabajo.

### Reglas no negociables

- **Prohibido mergear o hacer push a `main` de forma autónoma**: Solo se puede pasar a `main` cuando el usuario haya probado exhaustivamente la versión en `dev` y haya dado su autorización explícita.
- **Acciones destructivas**: Cualquier comando de alto impacto (`git push --force`, `git reset --hard`, `git clean -f`, `git checkout .`, `git rebase -i` destructivo) exige:
  1. Explicar por qué es técnicamente necesario.
  2. Informar el riesgo de pérdida de datos.
  3. Solicitar y recibir autorización explícita del usuario antes de invocarlo.
- **Regla de no inventar**: No inventar flags, subcomandos o sintaxis de Git. Ante dudas, consultar `git <comando> --help` o verificar la versión de Git local.

---

## Flujo de Trabajo

### Paso 1: Diagnóstico y verificación socrática

1. Antes de cualquier operación que altere el estado, ejecuta la comprobación de estado:
   ```bash
   python3 .agent/skills/usar-git/scripts/check_git_status.py
   ```
   *(Si el script no está disponible en el entorno, inspecciona con `git status --porcelain` y `git branch --show-current`).*
2. Identifica en qué rama te encuentras y qué archivos están modificados, en *stage* o sin seguimiento.
3. Si el usuario pide una tarea nueva y te encuentras en `main` o `dev`, propón crear una rama de soporte.

### Paso 2: Creación de ramas de trabajo (Mejores prácticas)

- Las tareas no se trabajan directamente en `main` ni en `dev` salvo correcciones triviales de un solo commit aprobadas previamente.
- Nomenclatura obligatoria:
  - Funcionalidades nuevas: `feature/<nombre-descriptivo-kebab-case>`
  - Corrección de bugs: `fix/<nombre-descriptivo-kebab-case>`
  - Documentación / refactor: `docs/<nombre>` o `refactor/<nombre>`
- Procedimiento:
  ```bash
  # Siempre nacer de dev actualizado
  git checkout dev
  git pull origin dev
  git checkout -b feature/nombre-tarea
  ```

### Paso 3: Elaboración de Commits

1. Revisa los cambios antes de añadir:
   ```bash
   git status
   git diff
   ```
2. Añade únicamente los archivos pertinentes (`git add <archivos>`, evita `git add .` indiscriminado).
3. Escribe el mensaje usando **Conventional Commits**:
   - Formato: `<tipo>(<ámbito opcional>): <descripción clara en imperativo/presente>`
   - Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
   - Ejemplo: `feat(auth): implementar middleware de sesion`

### Paso 4: Integración en la rama `dev`

1. Una vez concluida la funcionalidad y pasadas las pruebas locales:
   ```bash
   git checkout dev
   git pull origin dev
   git merge feature/nombre-tarea
   git push origin dev
   ```
2. La rama `feature/*` local puede eliminarse tras la integración exitosa:
   ```bash
   git branch -d feature/nombre-tarea
   ```

### Paso 5: Promoción a `main` (Estricta autorización humana)

1. **Bajo ninguna circunstancia** ejecutes `git merge dev` en `main` ni `git push origin main` automáticamente.
2. Informa al usuario que los cambios se encuentran listos e integrados en `dev`.
3. Solicita la prueba y autorización con el siguiente formato:
   > *"Los cambios están en la rama `dev`. Por favor, realiza las pruebas que consideres necesarias. Confírmame explícitamente si autorizas el merge hacia `main`."*
4. Tras recibir la autorización explícita del usuario:
   ```bash
   git checkout main
   git pull origin main
   git merge dev
   git push origin main
   ```

---

## Formato de Salida

Al comunicar el resultado de una operación de Git, responde siempre con:
1. **Rama actual** y estado (`git status` resumido).
2. **Acción ejecutada** (comandos utilizados).
3. **Próximo paso sugerido** (o petición de autorización si involucra `main` o comandos destructivos).