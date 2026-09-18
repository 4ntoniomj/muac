---
name: crear-agentes
description: >-
  Genera y audita archivos AGENTS.md para trabajar con orquestador y subagentes: uno en la raíz
  del proyecto que coordina fases, delegación, verificación, redacción y seguridad, y uno por
  subcarpeta de dominio o stack con su ámbito, comandos y la lista de skills que puede usar ese
  subagente (siempre con mejorar-skills; las que falten se crean con crear-skills). Inspecciona el
  repositorio, pregunta siguiendo SDD (especificación, arquitectura, tareas, verificación) y
  controla el presupuesto de contexto. Activar cuando el usuario pida crear, reorganizar, reducir
  o revisar AGENTS.md, CLAUDE.md o reglas de agentes por carpeta, o configurar los agentes de un
  proyecto o monorepo. No usar para crear skills (usar crear-skills), modificar skills existentes
  (usar mejorar-skills), implementar código o specs de producto, ni configurar hooks o ajustes de
  la herramienta.
metadata:
  version: "2.2.0"
---

# crear-agentes

## Contexto y objetivo

Un solo archivo de reglas largo se paga en cada sesión y mezcla instrucciones de stacks que no tocan. Esta skill reparte las reglas en dos niveles:

- `AGENTS.md` raíz: el orquestador. Decide si resolver o delegar, aplica SDD a las tareas con varias fases, valida cada fase y cubre las 4 áreas críticas (orquestación, redacción, verificación de código, seguridad). Máximo 300 líneas y 5000 tokens estimados.
- `<carpeta>/AGENTS.md`: el subagente de esa carpeta. Hereda el raíz y solo añade ámbito, skills permitidas, comandos de verificación y reglas locales. Máximo 100 líneas y 1000 tokens.

La lista de skills de cada subagente cumple tres reglas: toda skill listada existe en el catálogo (si no, se crea con `crear-skills`), `mejorar-skills` está siempre, y ninguna skill del stack se sustituye por conocimiento genérico.

Criterio de éxito: `validate_agents_md.py --tree <repo> --strict` con código 0 y el usuario confirmó el mapa de carpetas, las skills y los comandos.

## Tarea o flujo de trabajo

Scripts en `.agent/skills/crear-agentes/scripts/`, ejecutados desde la raíz del proyecto. Salida JSON.

### Paso 1. Inspeccionar el repositorio

```bash
python3 .agent/skills/crear-agentes/scripts/inspect_repo.py --root .
```

Presenta: stack de la raíz, carpetas candidatas con plantilla sugerida, comandos declarados en manifiestos, AGENTS.md/CLAUDE.md existentes y skills del catálogo. Si ya hay AGENTS.md, audítalos primero:

```bash
python3 .agent/skills/crear-agentes/scripts/validate_agents_md.py --tree .
```

Verificación: código 0 en la inspección y hallazgos de la auditoría listados.

### Paso 2. Elicitar con SDD

Sigue las 4 fases de [sdd-elicitation.md](references/sdd-elicitation.md), cada una cerrada con confirmación del usuario. Máximo 3 preguntas por turno, con respuestas por defecto sacadas del paso 1:

1. Especificación: propósito, fuera de alcance y reglas de seguridad propias.
2. Arquitectura: carpetas con subagente y plantilla de cada una.
3. Tareas: skills de cada subagente.
4. Verificación: comandos reales por carpeta.

Verificación: tabla carpeta → rol → plantilla → skills → comandos, aprobada.

### Paso 3. Asegurar las skills

Para cada carpeta:

```bash
python3 .agent/skills/crear-skills/scripts/find_skills.py --query "<stack y tareas de la carpeta>" --catalog .agent/skills
```

1. Asigna las skills del catálogo que encajen y añade siempre `mejorar-skills`.
2. Si falta una skill para una tecnología de la carpeta, pide confirmación y aplica `crear-skills`, una skill cada vez. No sigas con esa carpeta hasta que la skill pase su validación.
3. Si el usuario corrige durante este proceso cómo trabaja una skill existente, aplica `mejorar-skills` sobre ella antes de continuar.

Verificación: cada skill listada tiene `SKILL.md` en el catálogo.

### Paso 4. Verificar comandos

Solo se escriben comandos con origen comprobado: `"source"` de manifiesto en la salida del paso 1, o binario presente (`command -v <bin>`) y subcomando visible en `<bin> --help`. Un comando que falla esa comprobación no entra como obligatorio: se pregunta si instalar la herramienta o usar otro.

Verificación: lista de comandos con su origen.

### Paso 5. Escribir el AGENTS.md raíz

Parte de [multiagent-orchestration.md](templates/multiagent-orchestration.md). Si existe un AGENTS.md, haz antes un respaldo en `.agent/backups/agents/<AAAAMMDDTHHMMSS>/` y conserva lo que sea específico del proyecto. Sigue [writing-rules.md](references/writing-rules.md) y [token-economy.md](references/token-economy.md).

### Paso 6. Escribir los AGENTS.md de subcarpeta

Parte de la plantilla del stack: [fullstack-ts.md](templates/fullstack-ts.md), [python-data-ml.md](templates/python-data-ml.md) o [systems-go-rust.md](templates/systems-go-rust.md). Para una carpeta de dominio de negocio (`src/<dominio>/`) usa [dominio-squad.md](templates/dominio-squad.md), que lista las skills en tabla: tecnología o tarea, skill asignada y uso. No copies reglas del raíz. Si una carpeta necesita un procedimiento largo, llévalo a una skill según [rules-vs-skills-matrix.md](references/rules-vs-skills-matrix.md).

Para tareas con varias fases, crea `specs/` con [spec-sdd.md](templates/spec-sdd.md) si no existe.

### Paso 7. Compatibilidad con herramientas

Claude Code no lee `AGENTS.md`, solo `CLAUDE.md`. Propón (y crea solo con confirmación) un `CLAUDE.md` con la línea `@AGENTS.md` junto a cada AGENTS.md; si ya existe un `CLAUDE.md` con contenido, fusiona en lugar de sustituir. Antigravity lee `AGENTS.md` en la raíz; la carga de los anidados no está confirmada, por eso el orquestador indica al subagente qué archivo leer.

### Paso 8. Validar

```bash
python3 .agent/skills/crear-agentes/scripts/validate_agents_md.py --tree . --strict
```

Corrige y repite hasta obtener código 0.

## Formato de salida

1. Mapa aprobado: carpeta, rol, plantilla, skills, comandos con su origen.
2. Skills creadas con `crear-skills` y cambios hechos con `mejorar-skills`, si los hubo.
3. Archivos creados o modificados, con ruta del respaldo de los sustituidos.
4. Métricas por archivo (líneas y tokens estimados frente al máximo).
5. JSON de `validate_agents_md.py --tree . --strict` con código 0.
6. Pendientes: comandos sin verificar, decisiones aplazadas.

## Restricciones y reglas

- No escribas comandos, scripts ni skills que no hayas comprobado que existen.
- No sobrescribas AGENTS.md ni CLAUDE.md existentes sin respaldo y confirmación.
- No crees carpetas ni skills sin confirmación del usuario.
- Un AGENTS.md de subcarpeta nunca autoriza a orquestar ni a editar fuera de su carpeta.
- `mejorar-skills` figura en la lista de skills de todo subagente.
- Presupuestos: raíz ≤ 300 líneas y ≤ 5000 tokens estimados; subcarpeta ≤ 100 líneas y ≤ 1000 tokens.
- Sin adjetivos inflados, mayúsculas imperativas, contrastes forzados, relleno ni diagramas Mermaid.
- Emojis en encabezados, separadores `---` y diagramas de texto en bloque de código están permitidos.
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Proyecto real `ria` (cliente de escritorio Tauri + React): auditoría de los AGENTS.md anteriores, preguntas SDD, archivos generados y validación: [EXAMPLE.md](EXAMPLE.md).
