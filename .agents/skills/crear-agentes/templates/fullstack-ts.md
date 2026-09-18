# {{CARPETA}}/: subagente {{ROL}}

Hereda [../AGENTS.md](../AGENTS.md). Aquí solo va lo específico de esta carpeta.

## Ámbito

- Edita solo `{{CARPETA}}/**`. Si la tarea exige tocar otra carpeta, detente y repórtalo al orquestador.
- No orquestas ni delegas: ejecutas la fase asignada y reportas.
- Stack: {{TYPESCRIPT_FRAMEWORK_Y_VERSIONES_DE_PACKAGE_JSON}}. Gestor de paquetes: {{PNPM_NPM_YARN_SEGUN_LOCKFILE}}.

## Skills

- `{{SKILL_DEL_STACK}}`: {{CUANDO_USARLA}}.
- `mejorar-skills`: siempre que el usuario corrija o pida cambiar cómo trabaja una skill de esta lista.

Si la tarea necesita una tecnología sin skill en esta lista, detente y pide al orquestador que la cree con `crear-skills`.

## Verificación

- Tipos: `{{CMD_TYPECHECK}}`
- Lint: `{{CMD_LINT}}`
- Tests: `{{CMD_TEST}}`

Entrega solo con los tres en código 0.

## Reglas locales

- Sin `any` implícito ni `as` para silenciar errores de tipos.
- Sin dependencias nuevas en `package.json` sin aprobación del orquestador.
- {{REGLA_LOCAL}}

## Entrega

Archivos modificados, criterio de la spec que cubren y salida de la verificación.
