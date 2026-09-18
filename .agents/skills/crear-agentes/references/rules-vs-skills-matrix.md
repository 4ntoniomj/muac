# Regla en AGENTS.md, skill o spec

Decide dónde vive una instrucción antes de escribirla. Un AGENTS.md con procedimientos largos gasta contexto en cada sesión; una skill con reglas globales no se carga cuando hace falta.

## Matriz

| Pregunta | Sí → | No → |
| :--- | :--- | :--- |
| ¿Aplica a casi todas las tareas del repositorio? | AGENTS.md raíz | Siguiente pregunta |
| ¿Aplica solo a una carpeta o stack? | AGENTS.md de esa carpeta (si es breve) o skill (si es un procedimiento) | Siguiente pregunta |
| ¿Es un procedimiento de varios pasos, con comandos o verificación propios? | Skill | Siguiente pregunta |
| ¿Se reutiliza en otros proyectos? | Skill | AGENTS.md del proyecto |
| ¿Describe qué debe hacer una funcionalidad concreta (contratos, criterios de aceptación)? | `specs/<id>.md` | — |
| ¿Es conocimiento extenso de consulta (tablas, APIs, normativa)? | `references/` de una skill | — |

## Ejemplos

| Instrucción | Lugar | Por qué |
| :--- | :--- | :--- |
| "Responde en español técnico sobrio" | AGENTS.md raíz | Aplica a todo |
| "Pide confirmación antes de acciones destructivas" | AGENTS.md raíz | Seguridad global |
| "Edita solo `src/**`; tests con `pnpm run test`" | `src/AGENTS.md` | Ámbito y comandos locales |
| "Cómo construir el aro de contexto con SVG y umbrales de color" | Skill `react-desktop-ui` | Procedimiento del dominio |
| "Flujo de migración de esquema con verificación de sentencias destructivas" | Skill de migraciones | Procedimiento reutilizable |
| "El endpoint `/accounts` devuelve 429 al agotar la cuota" | `specs/02-...md` | Contrato de una funcionalidad |
| "Usa `ruff`, no `black`" | Skill del stack Python (con `mejorar-skills`) | Preferencia sobre cómo trabaja una skill |

## Señales de que algo está en el sitio equivocado

- Un AGENTS.md de subcarpeta con más de 60 líneas suele contener un procedimiento: pásalo a una skill.
- Una skill cuyo `SKILL.md` repite reglas de tono o seguridad del raíz: elimínalas de la skill.
- Una spec con reglas de estilo: pásalas al AGENTS.md o a la skill del stack.
- Un AGENTS.md que copia la descripción del producto del README: sustitúyela por una frase y el enlace.
