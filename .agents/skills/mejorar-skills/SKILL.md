---
name: mejorar-skills
description: >-
  Mejora skills que ya existen en el catálogo .agent/skills a partir de lo que pide o corrige el
  usuario: entiende la petición y la clasifica en contradicción (se cambia la regla de la skill),
  ampliación aplicable ya (se añade a la skill) o mejora futura (se apunta en el backlog de la
  skill); además corrige descriptions que activan mal la skill, mueve pasos mecánicos a scripts,
  sustituye comandos viejos u obsoletos y recalibra eval_cases.json, con respaldo y comparación de
  evals antes y después. Activar cuando el usuario corrija, rechace o quiera cambiar cómo trabaja
  una skill ("la skill propone X y a partir de ahora quiero Y"), pida auditar, refactorizar o
  actualizar una skill del catálogo, quiera apuntar en una skill algo para más adelante, cuando
  una skill se active sin deber o no se active cuando debe, y al cerrar una tarea con
  correcciones. No usar para crear o importar skills nuevas (usar crear-skills), editar AGENTS.md
  (usar crear-agentes) ni modificar componentes, código o dependencias del proyecto.
metadata:
  version: "2.0.0"
---

# mejorar-skills

## Contexto y objetivo

Cada corrección del usuario que no llega a la skill se repite en la siguiente sesión. Esta skill cierra ese ciclo: lo que el usuario quiere queda escrito en la skill que lo provocó, sin perder lo que no se puede aplicar todavía y sin romper el enrutamiento.

Cada petición termina en uno de estos destinos:

| Tipo | Situación | Acción |
| :--- | :--- | :--- |
| A. Contradicción | La skill dice lo contrario de lo que pide el usuario | Se sustituye la regla en todos los archivos de la skill |
| B. Ampliación | Compatible con la skill y aplicable ya | Se añade en la sección que corresponde |
| C. Futura | Útil, pero falta algo para aplicarla (herramienta, decisión, trabajo mayor) o el usuario la pide para más adelante | Se registra en `references/backlog.md` con la condición para aplicarla |
| D. Ya cubierta | La skill ya lo dice | No se cambia; se cita la línea |

Criterio de éxito: cada punto de la petición clasificado con evidencia, respaldo creado, `validate_skill.py --strict` con código 0 y `diff_skill_evals.py` sin regresiones (o con regresiones aceptadas por el usuario).

## Tarea o flujo de trabajo

Scripts propios en `.agent/skills/mejorar-skills/scripts/`; usa también `crear-skills/scripts/validate_skill.py` y `find_skills.py`. Salida JSON.

### Modo cierre de tarea

Cuando se invoca al terminar una tarea (regla del orquestador), revisa la conversación: ¿el usuario corrigió, rechazó o pidió cambiar algo del trabajo guiado por una skill? Si no, termina sin cambios y sin informe. Si sí, sigue el flujo completo con esos puntos.

### Paso 1. Entender la petición

1. Reformula cada punto en una línea: "En `<skill>`, quieres `<cambio>` porque `<motivo>`".
2. Localiza la skill:
   ```bash
   python3 .agent/skills/crear-skills/scripts/find_skills.py --name <skill> --exact --catalog .agent/skills
   ```
3. Pregunta solo si falta algo, máximo 3 preguntas y con respuesta por defecto. Las dudas habituales:
   - ¿Es permanente o solo para esta tarea? (por defecto: permanente si el usuario dice "siempre", "nunca", "a partir de ahora" o lo repite; puntual en otro caso). Lo puntual no se escribe en la skill.
   - ¿A qué skill afecta, si hay varias candidatas?
   - ¿Es una preferencia de este proyecto o general? Si aplica a todo el repositorio y no a una skill, corresponde al AGENTS.md (derivar a `crear-agentes`).

Verificación: lista de puntos permanentes con su skill.

### Paso 2. Leer la skill

Lee `SKILL.md`, `EXAMPLE.md` y `references/eval_cases.json`. Lista el backlog:

```bash
python3 .agent/skills/mejorar-skills/scripts/backlog.py list --path .agent/skills/<skill>
```

Busca con `grep -rn` los términos de cada punto en toda la carpeta de la skill (plantillas, referencias y scripts incluidos).

### Paso 3. Clasificar

Construye la tabla de [classification-guide.md](references/classification-guide.md#tabla-de-clasificación): punto, tipo (A/B/C/D), evidencia `archivo:línea`, acción. Añade los problemas técnicos detectados al leer (description que se activa mal, lógica mecánica en prosa, comandos obsoletos) según [refactoring-patterns.md](references/refactoring-patterns.md).

- Instrucción explícita y permanente del usuario: A y B se aplican sin pedir más permiso.
- Punto inferido por ti (no dicho por el usuario): muestra la tabla y pide confirmación.
- Relajar una regla de seguridad (no inventar, confirmar acciones destructivas, secretos): solo con confirmación explícita tras explicar el riesgo, y acotada al caso.

### Paso 4. Respaldar

```bash
python3 .agent/skills/mejorar-skills/scripts/backup_skill.py create --skill <skill> --reason "<resumen>"
```

Verificación: JSON con `sha256` y número de archivos. Sin respaldo no se edita.

### Paso 5. Aplicar

- **A**: sustituye la regla en todos los sitios donde aparece (búsqueda del paso 2). No dejes la versión antigua en ejemplos, plantillas ni scripts.
- **B**: añade la regla en la sección que le toca (paso del flujo, formato de salida o restricciones). Si ocupa más de 10 líneas, va a `references/` con enlace.
- **C**: regístrala:
  ```bash
  python3 .agent/skills/mejorar-skills/scripts/backlog.py add --path .agent/skills/<skill> --origen "<petición literal>" --propuesta "<cambio>" --condicion "<qué falta para aplicarla>"
  ```
- A y B aplicados también se registran con `--estado aplicada`, para dejar traza.
- Si una entrada abierta del backlog ya se puede aplicar, aplícala y ciérrala con `backlog.py estado --a aplicada`.
- Comandos nuevos o cambiados: comprueba binarios con `check_commands.py --path .agent/skills/<skill>` y flags con `<bin> --help`.
- Sube `metadata.version`: parche para B y C, menor para A o cambios de description.

### Paso 6. Recalibrar evals

Si el cambio afecta a cuándo debe activarse la skill, añade o ajusta casos en `references/eval_cases.json` que reproduzcan la situación (manteniendo al menos 5 positivos y 5 negativos cercanos). Si afecta a cómo trabaja, refleja el nuevo comportamiento en `EXAMPLE.md`.

### Paso 7. Verificar

```bash
python3 .agent/skills/crear-skills/scripts/validate_skill.py --path .agent/skills/<skill> --strict
python3 .agent/skills/mejorar-skills/scripts/diff_skill_evals.py --before <respaldo.tar.gz> --after .agent/skills/<skill> --catalog .agent/skills
```

Con regresiones (código 1), corrige la description o explica al usuario por qué se aceptan. El proxy es léxico: detecta regresiones relativas, no garantiza el comportamiento del modelo. Con un comando de modelo aprobado por el usuario se puede usar `--judge-cmd`.

## Formato de salida

1. Tabla de clasificación: punto, tipo, evidencia, acción.
2. Ruta y `sha256` del respaldo.
3. Cambios por archivo (diff resumido de las líneas sustituidas o añadidas).
4. Entradas de backlog creadas o cerradas.
5. JSON de `validate_skill.py --strict` y resumen de `diff_skill_evals.py` (antes, después, `fixed`, `regressed`).
6. Nueva versión de la skill.

## Restricciones y reglas

- No edites sin respaldo verificado.
- No escribas en la skill peticiones puntuales ni preferencias que no sean del ámbito de esa skill.
- No dejes reglas contradictorias: la versión antigua desaparece de todos los archivos.
- No descartes una petición del usuario: si no se aplica, queda en el backlog con su condición.
- No relajes reglas de seguridad sin confirmación explícita.
- No inventes comandos, flags ni versiones: verifícalos antes de escribirlos.
- No crees skills nuevas desde aquí; si la petición no cabe en ninguna skill existente, deriva a `crear-skills`.
- `description` ≤ 1024 caracteres y cuerpo de `SKILL.md` < 500 líneas tras el cambio.
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Skill deficiente real (`asistente-frontend`): petición con contradicción, ampliación y mejora futura, falsos positivos y lógica en prosa, optimizada paso a paso con salidas reales: [EXAMPLE.md](EXAMPLE.md).
