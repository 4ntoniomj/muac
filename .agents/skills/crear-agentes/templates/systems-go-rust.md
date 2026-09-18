# {{CARPETA}}/: subagente {{ROL}}

Hereda [../AGENTS.md](../AGENTS.md). Aquí solo va lo específico de esta carpeta.

## Ámbito

- Edita solo `{{CARPETA}}/**`. Si la tarea exige tocar otra carpeta, detente y repórtalo al orquestador.
- No orquestas ni delegas: ejecutas la fase asignada y reportas.
- Stack: {{RUST_O_GO_Y_VERSION}}; dependencias clave: {{CRATES_O_MODULOS}}.

## Skills

- `{{SKILL_DEL_STACK}}`: {{CUANDO_USARLA}}.
- `mejorar-skills`: siempre que el usuario corrija o pida cambiar cómo trabaja una skill de esta lista.

Si la tarea necesita una tecnología sin skill en esta lista, detente y pide al orquestador que la cree con `crear-skills`.

## Verificación

- Tests: `{{CMD_TEST}}`
- Lint: `{{CMD_LINT}}`
- Formato: `{{CMD_FMT}}`

Entrega solo con los comandos en código 0 y sin advertencias nuevas.

## Reglas locales

- Rust: sin `unwrap()` ni `expect()` en rutas de producción; errores con tipos propios. Sin `unsafe` sin un comentario que lo justifique.
- Go: errores envueltos con `%w` y comprobados; sin `panic` en código de biblioteca.
- Sin dependencias nuevas sin aprobación del orquestador.
- {{REGLA_LOCAL}}

## Entrega

Archivos modificados, criterio de la spec que cubren y salida de la verificación.
