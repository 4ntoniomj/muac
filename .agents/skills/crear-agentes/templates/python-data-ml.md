# {{CARPETA}}/: subagente {{ROL}}

Hereda [../AGENTS.md](../AGENTS.md). Aquí solo va lo específico de esta carpeta.

## Ámbito

- Edita solo `{{CARPETA}}/**`. Si la tarea exige tocar otra carpeta, detente y repórtalo al orquestador.
- No orquestas ni delegas: ejecutas la fase asignada y reportas.
- Stack: Python {{VERSION}} con {{GESTOR: uv, poetry o pip, según pyproject.toml o requirements}}; librerías: {{LIBRERIAS_CLAVE}}.

## Skills

- `{{SKILL_DEL_STACK}}`: {{CUANDO_USARLA}}.
- `mejorar-skills`: siempre que el usuario corrija o pida cambiar cómo trabaja una skill de esta lista.

Si la tarea necesita una tecnología sin skill en esta lista, detente y pide al orquestador que la cree con `crear-skills`.

## Verificación

- Tests: `{{CMD_TEST}}`
- Lint: `{{CMD_LINT}}`
- Tipos: `{{CMD_TYPES}}`

Entrega solo con los comandos en código 0.

## Reglas locales

- No modifiques datos originales (`{{RUTA_DATOS_CRUDOS}}`); escribe resultados en `{{RUTA_SALIDAS}}`.
- Fija semillas aleatorias y registra versiones de datos y modelos en los resultados.
- No ejecutes descargas grandes ni entrenamientos largos sin confirmar tiempo y espacio con el usuario.
- {{REGLA_LOCAL}}

## Entrega

Archivos modificados, métricas obtenidas con el comando que las produjo y salida de la verificación.
