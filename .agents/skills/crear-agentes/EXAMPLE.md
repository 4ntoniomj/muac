# Ejemplo: crear-agentes

Proyecto real: `ria`, cliente de escritorio Tauri 2 + React 19 que ya tenía AGENTS.md generados con la versión anterior de esta skill. Salidas reales del 2026-09-17, recortadas con `…`. Los archivos nuevos se generaron en un directorio de prueba; el proyecto no se modificó.

## Caso 1. Reorganizar los AGENTS.md de un proyecto existente

### Entrada

> Rehaz los AGENTS.md de ria: un orquestador en la raíz y uno por subcarpeta para los subagentes, con sus skills.

### Ejecución intermedia

**Paso 1. Inspección**

```text
$ python3 .agent/skills/crear-agentes/scripts/inspect_repo.py --root .
greenfield: false
root_manifests:
  package.json  pnpm  [react, vite, tailwindcss, @tauri-apps/api, vitest, eslint, typescript]
    commands: pnpm run dev, pnpm run build, pnpm run typecheck, pnpm run lint, pnpm run test,
              pnpm run test:security, pnpm run tauri, pnpm run start:desktop, pnpm run build:desktop …
root_agent_files: AGENTS.md (144 líneas), CLAUDE.md -> AGENTS.md
candidates:
  qa-security/  {Python: 4, Shell: 1}        manifiestos: —          plantilla: python-data-ml   AGENTS.md (78 líneas)
  src/          {TypeScript: 19, CSS: 1}     hereda manifiestos de . plantilla: fullstack-ts     AGENTS.md (75 líneas)
  src-tauri/    {Rust: 28}                   Cargo.toml              plantilla: systems-go-rust  AGENTS.md (74 líneas)
    commands (convention): cargo build, cargo test, cargo clippy, cargo fmt --check
skills: crear-skills, desktop-security-pentest, mcp-desktop-client, react-desktop-ui, tauri-rust-desktop …
```

Auditoría de los archivos existentes:

```text
$ python3 .agent/skills/crear-agentes/scripts/validate_agents_md.py --tree .
valid: false
AGENTS.md (root)             144 líneas, ~4173 tokens
  A001 144 líneas; máximo 120.
  A002 ~4173 tokens estimados; máximo 1000.
  A003 Falta una sección (## o ###) para el área crítica: seguridad.
  A004 El raíz no referencia qa-security/AGENTS.md.   (ídem src/, src-tauri/)
  avisos: L001 ×9 (adjetivos inflados), L003, L004, L006, L007
qa-security/AGENTS.md (sub)   78 líneas, ~1467 tokens   B001, B002, B010 (sin sección "## Skills")
src/AGENTS.md (sub)           75 líneas, ~1500 tokens   B001, B002, B010
src-tauri/AGENTS.md (sub)     74 líneas, ~1520 tokens   B001, B002, B010
```

Los cuatro archivos suman unos 8660 tokens estimados que se cargan en cada sesión.

**Paso 2. SDD (resumen de los 4 turnos)**

1. Especificación. Por defecto se propone el propósito del AGENTS.md anterior en una frase y como regla propia de seguridad "tokens OAuth solo en keyring; PKCE con `prompt=select_account`" (sale de `specs/02-oauth-keyring.md`). El usuario confirma.
2. Arquitectura: `src/`, `src-tauri/` y `qa-security/` con subagente; `specs/` sin subagente. Se añade la regla "todo cambio en `src/` o `src-tauri/` termina con una fase de `qa-security/`". Confirmado.
3. Tareas: las skills que propone `find_skills.py` para cada carpeta, más `mejorar-skills`. Confirmado.
4. Verificación: ver paso 4.

**Paso 3. Skills.** Todas las skills del mapa existen en el catálogo. Si una lista incluyera una skill ausente, el validador lo bloquearía:

```text
$ python3 .agent/skills/crear-agentes/scripts/validate_agents_md.py --path qa-security/AGENTS.md
valid: false
B012 La skill 'python-fuzzing' no existe en el catálogo; créala con crear-skills.
exit=1
```

**Paso 4. Comandos**

| Comando | Origen | Comprobación |
| :--- | :--- | :--- |
| `pnpm run typecheck`, `lint`, `test`, `test:security` | `package.json` | Declarados en el manifiesto |
| `cargo test`, `cargo fmt --check` | Convención | `cargo 1.98.1` instalado; `cargo fmt --help` muestra `--check` |
| `cargo clippy --all-targets -- -D warnings` | Convención | `clippy 0.1.98`; `cargo clippy --help`: "-D / --deny [LINT] Set lint denied" |
| `cargo audit` (estaba en el AGENTS.md anterior) | Convención | `error: no such command: audit`: no instalado. No se escribe; queda como pregunta al usuario |

**Pasos 5 y 6. Archivos generados**

`AGENTS.md` (raíz, plantilla `multiagent-orchestration.md`):

```markdown
# ria: reglas del orquestador

Cliente de escritorio para operar varias cuentas de Antigravity Pro: detecta el agotamiento de cuota y cambia de cuenta sin perder la conversación.
Stack: Tauri 2 (Rust, edition 2021), React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, pnpm.

## Mapa del repositorio

| Carpeta | Subagente | Reglas |
| :--- | :--- | :--- |
| `src/` | Interfaz React | [src/AGENTS.md](src/AGENTS.md) |
| `src-tauri/` | Núcleo Rust, OAuth, keyring y cliente MCP | [src-tauri/AGENTS.md](src-tauri/AGENTS.md) |
| `qa-security/` | QA y pentesting | [qa-security/AGENTS.md](qa-security/AGENTS.md) |
| `specs/` | ninguno | Especificaciones SDD (`01` a `05`) |

## Orquestación

- Tarea de un paso en una sola carpeta: resuélvela tú con la skill de esa carpeta.
- Tarea con varias fases o carpetas: escribe o actualiza `specs/<id>.md` (especificación, arquitectura, tareas, verificación) y espera aprobación antes de delegar.
- Ante ambigüedad, pregunta antes de suponer: máximo 3 preguntas por turno, cada una con respuesta por defecto.
- Delega una fase por subagente. Su prompt empieza con "Lee `<carpeta>/AGENTS.md`" e incluye la spec, los archivos afectados y el criterio de aceptación; no un resumen de la conversación.
- Todo cambio en `src/` o `src-tauri/` termina con una fase de `qa-security/`.

## Skills

- Antes de delegar, comprueba que existen en `.agent/skills/` las skills listadas en el AGENTS.md de la carpeta. Si falta una, créala con `crear-skills` y añádela a la lista.
- Si el usuario corrige, rechaza o pide un cambio sobre cómo trabaja una skill, aplica `mejorar-skills` antes de seguir: cambia la regla contradicha, añade la compatible o registra la futura en el backlog de la skill.
- Al cerrar cada tarea, comprueba que ninguna corrección del usuario quedó sin pasar por `mejorar-skills`.

## Verificación de código

- Globales: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run test:security`.
- Una fase no está terminada sin la salida real de sus comandos con código 0.
- Si algo falla, busca la causa raíz antes de volver a editar. Cambios mínimos; respeta estilo y comentarios existentes.

## Redacción

- Español técnico sobrio. Sin saludos, cortesías, cierres ni adjetivos inflados.
- Sin contrastes forzados ni viñetas que empiecen todas con una etiqueta en negrita.
- Cita archivos con ruta relativa y línea.

## Seguridad

- Pide confirmación antes de borrar, sobrescribir sin respaldo, migrar datos o reescribir historial de git.
- No añadas dependencias sin permiso. No leas ni muestres secretos (`.env`, claves) salvo petición explícita.
- No inventes APIs, flags ni resultados. Si no puedes verificar algo, dilo.
- Tokens OAuth solo en el keyring del sistema; nunca en `localStorage`, cookies, logs ni archivos.
- El flujo OAuth usa PKCE y `prompt=select_account` para no reutilizar sesiones.
```

`src-tauri/AGENTS.md` (subcarpeta, plantilla `systems-go-rust.md`):

```markdown
# src-tauri/: subagente del núcleo Rust

Hereda [../AGENTS.md](../AGENTS.md). Aquí solo va lo específico de esta carpeta.

## Ámbito

- Edita solo `src-tauri/**`. Si la tarea exige tocar otra carpeta, detente y repórtalo al orquestador.
- No orquestas ni delegas: ejecutas la fase asignada y reportas.
- Stack: Rust (edition 2021), Tauri 2, `keyring` 2.3; cliente MCP sobre JSON-RPC 2.0.

## Skills

- `tauri-rust-desktop`: comandos IPC, OAuth con PKCE, keyring, rotación de cuentas por cuota.
- `mcp-desktop-client`: descubrimiento y ejecución de herramientas MCP (stdio y SSE).
- `mejorar-skills`: siempre que el usuario corrija o pida cambiar cómo trabaja una skill de esta lista.

Si la tarea necesita una tecnología sin skill en esta lista, detente y pide al orquestador que la cree con `crear-skills`.

## Verificación

Dentro de `src-tauri/`:

- Tests: `cargo test`
- Lint: `cargo clippy --all-targets -- -D warnings`
- Formato: `cargo fmt --check`

Entrega solo con los comandos en código 0 y sin advertencias nuevas.

## Reglas locales

- Sin `unwrap()` ni `expect()` en rutas de producción; errores con tipos propios.
- Sin `unsafe` sin un comentario que lo justifique.
- Sin crates nuevos sin aprobación del orquestador.

## Entrega

Archivos modificados, criterio de la spec que cubren y salida de la verificación.
```

`src/AGENTS.md` y `qa-security/AGENTS.md` siguen la misma estructura con sus skills (`react-desktop-ui`; `desktop-security-pentest`) y comandos (`pnpm run typecheck`, `lint`, `test`; `pnpm run test:security`).

**Paso 7. Compatibilidad.** `CLAUDE.md` ya era un enlace simbólico a `AGENTS.md` en la raíz: se mantiene. Para las subcarpetas se propone un `CLAUDE.md` con `@AGENTS.md`; el usuario decide.

**Paso 8. Validación**

```text
$ python3 .agent/skills/crear-agentes/scripts/validate_agents_md.py --tree . --strict
{
  "valid": true,
  "strict": true,
  "files": [
    {"path": "AGENTS.md", "role": "root", "metrics": {"lines": 47, "tokens_est": 817, "max_lines": 120, "max_tokens": 1000}, "errors": [], "warnings": []},
    {"path": "qa-security/AGENTS.md", "role": "sub", "metrics": {"lines": 31, "tokens_est": 331, "skills": ["desktop-security-pentest", "mejorar-skills"]}, "errors": [], "warnings": []},
    {"path": "src/AGENTS.md", "role": "sub", "metrics": {"lines": 36, "tokens_est": 360, "skills": ["react-desktop-ui", "mejorar-skills"]}, "errors": [], "warnings": []},
    {"path": "src-tauri/AGENTS.md", "role": "sub", "metrics": {"lines": 37, "tokens_est": 380, "skills": ["tauri-rust-desktop", "mcp-desktop-client", "mejorar-skills"]}, "errors": [], "warnings": []}
  ]
}
exit=0
```

### Salida

```text
Mapa aprobado:
| Carpeta       | Rol                    | Plantilla        | Skills                                               | Comandos (origen)                          |
| src/          | Interfaz React         | fullstack-ts     | react-desktop-ui, mejorar-skills                     | pnpm run typecheck/lint/test (package.json) |
| src-tauri/    | Núcleo Rust            | systems-go-rust  | tauri-rust-desktop, mcp-desktop-client, mejorar-skills | cargo test/clippy/fmt (convención, --help) |
| qa-security/  | QA y pentesting        | python-data-ml   | desktop-security-pentest, mejorar-skills             | pnpm run test:security (package.json)     |

Skills creadas: ninguna (todas existían). Cambios con mejorar-skills: ninguno.
Archivos: AGENTS.md, src/AGENTS.md, src-tauri/AGENTS.md, qa-security/AGENTS.md
Respaldo de los anteriores: .agent/backups/agents/<AAAAMMDDTHHMMSS>/
Métricas: 8660 → 1888 tokens estimados en total (−78 %); raíz 47/120 líneas.
Validación: valid=true, strict, código 0.
Pendiente: ¿instalar cargo-audit o retirar la auditoría de crates de qa-security? ¿CLAUDE.md con @AGENTS.md en subcarpetas?
```

## Caso 2. Petición que no corresponde

### Entrada

> La skill tauri-rust-desktop sigue proponiendo unwrap(); cámbiala.

### Comportamiento esperado

No se activa `crear-agentes`: es una corrección sobre una skill existente. Corresponde a `mejorar-skills`. Si la preferencia también debe quedar como regla local de `src-tauri/`, el AGENTS.md ya la contiene ("Sin `unwrap()` ni `expect()` en rutas de producción").
