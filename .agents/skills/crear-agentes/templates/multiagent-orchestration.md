# {{NOMBRE_PROYECTO}}: reglas del orquestador

{{PROPOSITO: qué hace el proyecto y para quién, 1 o 2 frases}}
Stack: {{STACK_CON_VERSIONES_DE_LOS_MANIFIESTOS}}.

## Mapa del repositorio

| Carpeta | Subagente | Reglas |
| :--- | :--- | :--- |
| `{{CARPETA_1}}/` | {{ROL_1}} | [{{CARPETA_1}}/AGENTS.md]({{CARPETA_1}}/AGENTS.md) |
| `{{CARPETA_2}}/` | {{ROL_2}} | [{{CARPETA_2}}/AGENTS.md]({{CARPETA_2}}/AGENTS.md) |
| `specs/` | ninguno | Especificaciones SDD |

## Orquestación

- Tarea de un paso en una sola carpeta: resuélvela tú con la skill de esa carpeta.
- Tarea con varias fases o carpetas: escribe o actualiza `specs/<id>.md` (especificación, arquitectura, tareas, verificación) y espera aprobación antes de delegar.
- Ante ambigüedad, pregunta antes de suponer: máximo 3 preguntas por turno, cada una con respuesta por defecto.
- Delega una fase por subagente. Su prompt empieza con "Lee `<carpeta>/AGENTS.md`" e incluye la spec, los archivos afectados y el criterio de aceptación; no un resumen de la conversación.
- Valida cada fase con sus comandos antes de lanzar la siguiente. Al final, resume archivos cambiados y verificaciones.

## Skills

- Antes de delegar, comprueba que existen en `.agent/skills/` las skills listadas en el AGENTS.md de la carpeta. Si falta una, créala con `crear-skills` y añádela a la lista.
- Si el usuario corrige, rechaza o pide un cambio sobre cómo trabaja una skill, aplica `mejorar-skills` antes de seguir: cambia la regla contradicha, añade la compatible o registra la futura en el backlog de la skill.
- Al cerrar cada tarea, comprueba que ninguna corrección del usuario quedó sin pasar por `mejorar-skills`.

## Verificación de código

- Globales: `{{CMD_TEST}}`, `{{CMD_LINT}}`, `{{CMD_BUILD}}`.
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
{{REGLA_DE_SEGURIDAD_DEL_PROYECTO}}
