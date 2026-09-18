---
name: crear-skills
description: >-
  Crea skills nuevas para el catálogo .agent/skills a partir de una necesidad del usuario:
  aclara la petición con preguntas socráticas, busca la mejor skill existente en catálogos
  locales y remotos (skills.sh, anthropics/skills, GitHub), la puntúa con una rúbrica y la
  adapta al español con fase de preguntas, regla de no inventar, divulgación progresiva,
  scripts deterministas, evals, licencia y procedencia; si ninguna candidata sirve, la
  construye desde plantilla. Activar cuando el usuario pida crear, diseñar, estructurar, buscar, importar
  o adaptar una skill (p. ej. "una skill para páginas web", "busca una skill de Terraform y
  mejórala") o cuando crear-agentes detecte que falta una skill en el catálogo. No usar para
  modificar, corregir o auditar una skill que ya existe en el catálogo (usar mejorar-skills),
  para redactar AGENTS.md (usar crear-agentes) ni para ejecutar la tarea del dominio.
metadata:
  version: "2.0.0"
---

# crear-skills

## Contexto y objetivo

Una skill buena no se escribe desde cero si ya existe otra probada por miles de usuarios: se localiza, se evalúa y se adapta. Esta skill convierte una petición ("quiero una skill para páginas web") en una skill instalada en el catálogo que:

- resuelve el caso real del usuario, confirmado mediante preguntas antes de construir nada;
- parte de la mejor candidata disponible, con licencia compatible y procedencia registrada;
- está escrita en español técnico y obliga a quien la use a preguntar ante ambigüedad y a no inventar comandos;
- separa lo que lee el modelo (`SKILL.md`) de lo determinista (`scripts/`) y del detalle bajo demanda (`references/`).

Criterio de éxito: `validate_skill.py --strict` devuelve código 0, la batería de evals tiene 5 casos positivos y 5 negativos cercanos, y el usuario aprobó la ficha y la candidata elegida.

Catálogo: por defecto `.agent/skills/`. La documentación actual de Antigravity usa `.agents/skills/`; si el proyecto usa esa ruta, trabaja sobre ella (los scripts buscan en ambas).

## Tarea o flujo de trabajo

Los scripts se invocan desde la raíz del proyecto, p. ej. `python3 .agent/skills/crear-skills/scripts/<script>.py`. Todos devuelven JSON.

### Paso 1. Entender la petición (método socrático)

1. Extrae de la petición y del repositorio lo que ya se sabe; no lo preguntes.
2. Pregunta lo que falte, **como máximo 3 preguntas por turno**, ordenadas por impacto. Cada pregunta propone una respuesta por defecto para que el usuario pueda contestar "sí":
   - Resultado: qué entregable concreto produce la skill (código, auditoría, documento, diseño).
   - Contexto: stack, proyecto o público al que se aplica.
   - Frontera: 3 peticiones que deben activarla y 2 parecidas que no.
   - Restricciones: herramientas obligatorias o prohibidas, nivel de autonomía, idioma de salida.
3. Resume las respuestas en la ficha de [search-and-adaptation.md](references/search-and-adaptation.md#ficha-de-la-skill) y pide confirmación.

Verificación: ficha confirmada por el usuario. Sin confirmación no se pasa al paso 2.

### Paso 2. Buscar en el catálogo local

```bash
python3 .agent/skills/crear-skills/scripts/find_skills.py --query "<necesidad en español e inglés>"
python3 .agent/skills/crear-skills/scripts/find_skills.py --name <nombre-propuesto> --exact
```

Si una skill del catálogo del proyecto ya cubre la ficha, detente y propone `mejorar-skills` sobre ella. Las coincidencias en catálogos de usuario (`~/.claude/skills`, `~/.gemini/...`) son candidatas para el paso 4.

Verificación: código 0 y lista revisada; ningún `name` duplicado en el catálogo del proyecto.

### Paso 3. Buscar fuentes remotas

Requiere red. Pide permiso antes de la primera consulta remota de la sesión.

1. Haz 2 o 3 búsquedas con términos adyacentes en inglés (la mayoría de skills públicas están en inglés):
   ```bash
   npx skills find "<términos>"
   ```
   `find` solo consulta skills.sh. `npx skills add` instala en directorios de agentes: no lo uses sin confirmación explícita.
2. Revisa los repositorios de referencia listados en [search-and-adaptation.md](references/search-and-adaptation.md#fuentes).
3. Descarga el `SKILL.md` crudo y el archivo de licencia de las 3 mejores candidatas a un directorio temporal fuera del catálogo y léelos completos. No evalúes a partir de resúmenes.

Verificación: cada candidata tiene URL, licencia leída y `SKILL.md` descargado.

### Paso 4. Evaluar candidatas

Puntúa cada candidata con la rúbrica de 8 criterios (0 a 2) de [search-and-adaptation.md](references/search-and-adaptation.md#rúbrica). Cada nota cita la evidencia (línea, archivo o métrica de instalaciones). La licencia es eliminatoria para copiar texto: sin licencia, la candidata solo sirve de inspiración.

Presenta una tabla con las candidatas y una recomendación: adaptar una, fusionar varias o crear desde cero. Decide el usuario.

Verificación: tabla con evidencia y decisión del usuario registrada.

### Paso 5. Diseñar la skill

Decide y muestra, antes de escribir archivos:

- `name` en kebab-case sin acentos, en español (p. ej. `paginas-web`), sin colisión (paso 2).
- `description` según [semantic-routing.md](references/semantic-routing.md): qué hace + "Activar cuando…" con el vocabulario del usuario + "No usar para…" con las skills vecinas.
- Reparto: flujo y criterio en `SKILL.md` (objetivo: menos de 200 líneas); cálculos, parsing y comprobaciones en `scripts/`; tablas, catálogos y guías largas en `references/`; esqueletos reutilizables en `templates/`.
- Plantilla base: [procedural-runbook](templates/procedural-runbook.md) para pasos con verificación, [script-wrapper](templates/script-wrapper.md) si el núcleo es un script, [reference-architecture](templates/reference-architecture.md) si el núcleo es conocimiento normativo.

Verificación: el diseño cumple [quality-checklist.md](references/quality-checklist.md#diseño).

### Paso 6. Construir el borrador fuera del catálogo

```bash
python3 .agent/skills/crear-skills/scripts/scaffold_skill.py --name <nombre> --template <plantilla> --root <directorio-temporal>
```

Si se adapta una candidata, copia sus archivos al mismo directorio temporal. Nada se escribe en el catálogo hasta el paso 9.

### Paso 7. Adaptar y mejorar

Aplica todas las mejoras obligatorias de [search-and-adaptation.md](references/search-and-adaptation.md#mejoras-obligatorias):

1. Traducir al español técnico sobrio; comandos, código, identificadores y nombres de API quedan en su idioma original.
2. Añadir como primer paso del flujo una fase socrática propia del dominio, con preguntas y respuestas por defecto.
3. Añadir la regla de no inventar: comandos, flags y APIs se verifican con `--help`, documentación oficial o el propio repositorio.
4. Dar a cada paso un criterio de verificación y definir el formato de salida.
5. Pasar a `scripts/` toda lógica que un programa resuelva con certeza (Python 3 de la biblioteca estándar, shebang, `chmod +x`, salida JSON, códigos 0/1/2).
6. Mover el detalle a `references/` con enlaces de un solo nivel desde `SKILL.md`.
7. Registrar la procedencia en `references/procedencia.md` (URL, fecha, licencia, cambios) y conservar la licencia si la fuente lo exige.
8. Dejar `references/backlog.md` con cabecera para que `mejorar-skills` registre mejoras futuras.

Revisa los scripts de terceros antes de ejecutarlos: descargas remotas encadenadas a shell, borrados, envíos de datos a red.

### Paso 8. Escribir la batería de evals

Rellena `references/eval_cases.json` con 5 casos positivos (vocabulario variado, formal e informal) y 5 negativos cercanos: peticiones que pertenecen a skills vecinas, no temas ajenos. Mide la línea base con el proxy léxico:

```bash
python3 .agent/skills/mejorar-skills/scripts/diff_skill_evals.py --after <directorio-temporal>/<nombre> --catalog .agent/skills
```

El proxy aproxima el enrutamiento por coincidencia léxica; no reproduce el modelo. Si falla positivos, añade a la description el vocabulario de esos casos; si activa negativos, refuerza "No usar para…".

### Paso 9. Validar e instalar

```bash
python3 .agent/skills/crear-skills/scripts/validate_skill.py --path <directorio-temporal>/<nombre> --strict
```

Con código 0, mueve la carpeta al catálogo y valida el catálogo completo para detectar nombres duplicados:

```bash
python3 .agent/skills/crear-skills/scripts/validate_skill.py --catalog .agent/skills
```

Verificación: ambos comandos con código 0.

## Formato de salida

Informe final en este orden, sin introducción:

1. Ficha confirmada (resultado, contexto, frontera, restricciones).
2. Tabla de candidatas: fuente, instalaciones, licencia, puntuación total, decisión.
3. Árbol de archivos creado bajo `.agent/skills/<nombre>/`.
4. `description` final con su número de caracteres.
5. Lista de mejoras aplicadas respecto a la candidata (paso 7).
6. JSON de `validate_skill.py --strict` y resumen del proxy de evals (aciertos en positivos y negativos).
7. Pendientes o datos no verificados, si los hay.

## Restricciones y reglas

- No inventes comandos, flags, paquetes, APIs ni métricas. Si no puedes verificar un dato, escríbelo como no verificado.
- No construyas antes de que el usuario confirme la ficha (paso 1) y la candidata (paso 4).
- No escribas en el catálogo antes de validar, ni sobrescribas una skill existente: los cambios sobre skills existentes son de `mejorar-skills`.
- No copies texto de una skill sin licencia o con una licencia que no permita modificar y redistribuir.
- No ejecutes scripts descargados sin haberlos leído, ni instales con `npx skills add` sin confirmación.
- Máximo 3 preguntas por turno, cada una con respuesta por defecto.
- `SKILL.md` en español; `name` en kebab-case sin acentos; `description` de 1024 caracteres como máximo y en tercera persona.
- Toda skill creada incluye `EXAMPLE.md`, `scripts/`, `templates/`, `references/eval_cases.json` y `references/backlog.md`.
- Mejoras de esta propia skill pendientes de aplicar: [backlog.md](references/backlog.md).

## Ejemplos

Caso completo "skill para páginas web", con preguntas, búsqueda real, rúbrica y resultado validado: [EXAMPLE.md](EXAMPLE.md).
