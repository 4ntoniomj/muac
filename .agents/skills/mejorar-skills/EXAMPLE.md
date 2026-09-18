# Ejemplo: mejorar-skills

Salidas reales ejecutadas el 2026-09-17 sobre un catálogo de prueba (la skill `asistente-frontend` y copias de las skills de dominio del catálogo como competidoras). Rutas acortadas con `…`.

## Caso 1. Skill deficiente con corrección, ampliación, mejora futura y falsos positivos

### Entrada

Skill de partida, `asistente-frontend/SKILL.md` (versión completa):

```markdown
---
name: asistente-frontend
description: Ayuda con frontend, webs, componentes, estilos, backend y todo lo relacionado con el desarrollo de aplicaciones.
---

# Asistente Frontend DEFINITIVO

Esta skill es la herramienta más potente para crear aplicaciones web de forma increíble.

## Instrucciones

1. Crea el proyecto con `npx create-react-app mi-app`.
2. Instala dependencias con `npm install`.
3. Revisa todos los componentes de `src/` y cuenta cuántas líneas tiene cada uno; si alguno supera 300 líneas, avísalo. Revisa también que cada componente tenga su archivo de test al lado.
4. Usa siempre CSS Modules para los estilos.
5. Ejecuta `npm test` antes de terminar.
```

Mensaje del usuario:

> Deja de usar npm, en mis proyectos uso siempre pnpm. Quiero que los componentes nuevos lleven test con Vitest. Y más adelante me gustaría que genere historias de Storybook, pero todavía no lo tengo instalado. Ah, y la skill se me activa cuando pregunto cosas de backend.

### Ejecución intermedia

**Paso 1. Entender.** Cuatro puntos, todos permanentes ("siempre", "quiero que", queja de activación) salvo Storybook, que el usuario aplaza. No hace falta preguntar.

**Paso 2. Leer la skill y diagnosticar.**

```text
$ python3 crear-skills/scripts/validate_skill.py --path …/asistente-frontend --text
INVÁLIDA: …/asistente-frontend
  [E070]  Falta EXAMPLE.md.
  [W033] SKILL.md La description no declara cuándo activarse ('Activar cuando…').
  [W034] SKILL.md La description no declara exclusiones ('No usar para…').
  [W050] SKILL.md Falta la sección canónica 'Contexto y Objetivo' (encabezado ## o ###).
  …
  [W061] SKILL.md:6 Adjetivo inflado: 'DEFINITIVO'.
  [W061] SKILL.md:8 Adjetivo inflado: 'potente'.
  [W061] SKILL.md:8 Adjetivo inflado: 'increíble'.
  [W080]  Falta el directorio scripts/.
  …
exit=1

$ python3 mejorar-skills/scripts/check_commands.py --path …/asistente-frontend
commands: npm (disponible, SKILL.md:21-22), npx (disponible, SKILL.md:19); missing: []
```

`check_commands.py` confirma que `npx` existe, pero eso no prueba que el comando esté vigente. Se comprueba la fuente oficial:

```text
$ npm view create-react-app version deprecated time.modified --json
{"version": "5.1.0", "time.modified": "2025-05-07T01:51:10.986Z"}
$ curl -sL https://react.dev/blog/2025/02/14/sunsetting-create-react-app | …
Today, we're deprecating Create React App for new apps, and encouraging existing apps to migrate to a framework, or to migrate to a build tool like Vite…
```

El registro de npm no marca el paquete como deprecado, pero el blog oficial de React sí lo hace (2025-02-14). Sustituto verificado con la ayuda real de pnpm:

```text
$ pnpm create --help
Creates a project from a `create-*` starter kit
Usage: pnpm create [OPTIONS] [COMMAND]...
  [COMMAND]...  The template name (e.g., `vite`, `create-vite`, `@scope/foo`) …
```

**Paso 3. Clasificar.**

| # | Punto | Tipo | Evidencia | Acción |
| :-- | :--- | :-: | :--- | :--- |
| 1 | Usar pnpm en lugar de npm | A | SKILL.md:12, 13, 16, 19–22 | Sustituir en flujo, bloque de código y restricciones |
| 2 | Test de Vitest en cada componente nuevo | B | Solo "archivo de test al lado", sin herramienta | Añadir a pasos 2–4 y plantilla de test |
| 3 | Historias de Storybook | C | Storybook no instalado (lo dice el usuario) | Backlog con condición |
| 4 | Se activa con backend | A (description) | description: "…backend y todo lo relacionado…" | Reescribir en tres partes y añadir negativos de backend |
| 5 | `create-react-app` deprecado | A (inferido, verificado) | SKILL.md:12, 19 | Sustituir por `pnpm create vite` |
| 6 | Conteo de líneas y tests en prosa | Patrón "lógica mecánica en prosa" | SKILL.md:14 | `scripts/check_components.py` |
| 7 | Faltan secciones, ejemplo y evals; adjetivos inflados | Patrón "estructura" | Validador | Reestructurar |

El punto 5 no lo dijo el usuario, pero es un comando obsoleto con fuente oficial; se incluye en la tabla mostrada al usuario, que lo aprueba.

**Paso 4. Respaldo.**

```text
$ python3 mejorar-skills/scripts/backup_skill.py create --skill asistente-frontend --catalog …/catalogo-demo --reason "pnpm, Vitest, Storybook futuro, falsos positivos de backend"
{
  "action": "create",
  "backup": {
    "id": "20260917T12585052Z",
    "file": "…/backups/skills/asistente-frontend/20260917T12585052Z.tar.gz",
    "sha256": "045c09c075aa63cc2613895995e6fa7813f51ca0583fded34f1de71957a8d0e6",
    "files": 1,
    …
  }
}
```

**Paso 5. Aplicar.** Nueva description y reglas principales:

```markdown
description: >-
  Crea y revisa proyectos y componentes React con TypeScript, Vite y pnpm: arranca el proyecto,
  genera componentes con CSS Modules y test de Vitest, y comprueba con un script el tamaño de los
  componentes y que cada uno tenga test. Activar cuando el usuario pida crear una app o un
  componente React, revisar componentes de src/ o añadir tests de componentes. No usar para
  backend, APIs, bases de datos ni servidores, para interfaces de escritorio Tauri (usar
  react-desktop-ui) ni para diseño visual de landings (usar paginas-web).

## Restricciones y reglas
- Gestor de paquetes: pnpm. No uses npm, npx ni yarn.
- No uses Create React App: está deprecado desde el 2025-02-14.
```

El paso 3 original pasa a ser una invocación:

```bash
python3 .agent/skills/asistente-frontend/scripts/check_components.py --src src --max-lines 300
pnpm vitest run
```

Backlog:

```text
$ python3 mejorar-skills/scripts/backlog.py add --path …/asistente-frontend --origen "Y más adelante me gustaría que genere historias de Storybook, pero todavía no lo tengo instalado." --propuesta "Generar Componente.stories.tsx junto a cada componente nuevo." --condicion "Storybook instalado en el proyecto (aparece en package.json)."
{"added": "BL-001", …}
$ python3 mejorar-skills/scripts/backlog.py add … --estado aplicada --origen "Deja de usar npm, en mis proyectos uso siempre pnpm." …
{"added": "BL-002", …}
$ python3 mejorar-skills/scripts/backlog.py add … --estado aplicada --origen "Quiero que los componentes nuevos lleven test con Vitest." …
{"added": "BL-003", …}
```

**Paso 6. Evals.** Se crea `references/eval_cases.json` con 5 positivos y 5 negativos; dos negativos reproducen la queja ("Crea un endpoint en el backend que devuelva los pedidos desde la base de datos", "Configura el servidor Express con autenticación JWT").

**Paso 7. Verificar (primera iteración).**

```text
$ python3 mejorar-skills/scripts/diff_skill_evals.py --before …/20260917T12585052Z.tar.gz --after …/asistente-frontend --catalog …/catalogo-demo
method: lexical-proxy-v3, competitors: 4
before {tp: 1, fp: 1, tn: 4, fn: 4, accuracy: 0.5, precision: 0.5, recall: 0.2}
after  {tp: 3, fp: 0, tn: 5, fn: 2, accuracy: 0.8, precision: 1.0, recall: 0.6}
fixed ['pos_02', 'pos_03', 'neg_01']   regressed []
```

`neg_01` (endpoint de backend) ya no activa la skill: la queja del usuario queda resuelta. Quedan dos positivos que gana `react-desktop-ui`. Segunda iteración: se añade a "Activar cuando…" el vocabulario de esos casos ("app web o componente React para navegador (tarjetas, tablas, formularios, paginación, precios)").

```text
$ python3 mejorar-skills/scripts/diff_skill_evals.py --before …/af-iter1 --after …/asistente-frontend --catalog …/catalogo-demo
before 0.8 → after 0.9   fixed ['pos_05']   regressed []   misses_after ['pos_01']

$ python3 crear-skills/scripts/routing_score.py --path …/react-desktop-ui --prompt "Crea un componente React PriceCard con título y precio."
score 0.8169, positive_hits [compo, preci, react], name_hits [react]
```

`pos_01` falla por una coincidencia léxica: "precio" y "precisión" (description de `react-desktop-ui`) comparten raíz en el proxy. Corregirlo exige tocar la description de otra skill (patrón "colisión con otra skill"). Es un punto inferido, así que no se aplica sin confirmación: se propone al usuario.

```text
$ python3 crear-skills/scripts/validate_skill.py --path …/asistente-frontend --strict
{"skill": "asistente-frontend", "strict": true, "valid": true, "errors": [], "warnings": [],
 "metrics": {"description_chars": 599, "body_lines": 52, "scripts": 1, "eval_cases": {"positive": 5, "negative": 5}, …}}
exit=0

$ python3 mejorar-skills/scripts/check_commands.py --path …/asistente-frontend
commands: pnpm (disponible), python3 (disponible); missing: []
```

### Salida

```text
Mejora de asistente-frontend (sin versión → 1.0.0)

Clasificación: 7 puntos (tabla del paso 3). A: 3 · B: 1 · C: 1 · patrones técnicos: 2.
Respaldo: …/backups/skills/asistente-frontend/20260917T12585052Z.tar.gz · sha256 045c09c0… · 1 archivo

Cambios:
- SKILL.md: description en tres partes; npm/npx → pnpm; create-react-app → pnpm create vite; secciones canónicas; adjetivos eliminados.
- scripts/check_components.py: nuevo (tamaño de componentes y test al lado).
- templates/componente.test.tsx: nuevo.
- EXAMPLE.md, references/eval_cases.json, references/backlog.md: nuevos.

Backlog: BL-001 abierta (Storybook) · BL-002 aplicada (pnpm) · BL-003 aplicada (Vitest)

Verificación:
- validate_skill.py --strict: valid, código 0
- diff_skill_evals.py (respaldo → final): accuracy 0.5 → 0.9; fixed pos_02, pos_03, pos_05, neg_01; regressed ninguno

Pendiente de confirmar: acotar la description de react-desktop-ui ("No usar para apps web de navegador (usar asistente-frontend)") para resolver pos_01.
```

## Caso 2. Petición puntual

### Entrada

> Para este componente concreto usa estilos en línea, que es un prototipo.

### Comportamiento esperado

Paso 1: la petición es puntual ("para este componente", "prototipo"). No se escribe en la skill ni en el backlog; se aplica solo en la tarea en curso. Si el usuario repitiera la preferencia en otras tareas, se preguntaría si pasa a ser permanente.
