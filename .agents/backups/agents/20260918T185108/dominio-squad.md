# Squad de Agentes: Dominio {{DOMINIO}} (`src/{{DOMINIO}}`)

Hereda del orquestador raíz. Escuadrón dedicado exclusivamente a la funcionalidad de {{DOMINIO}}.
Opera bajo el ciclo SDD, gobernado por skills y sobre la rama dev. No orquestas ni delegas tareas globales.

## Ámbito

- Edita únicamente dentro de `src/{{DOMINIO}}/**`. Prohibido tocar main u otras carpetas.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## Subagentes del escuadrón

- `{{DOMINIO}}-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `{{DOMINIO}}-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `{{DOMINIO}}-builder`: implementa lógica y tests unitarios (skill tecnológica asignada y `openspec-apply-change`).
- `{{DOMINIO}}-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## Skills

- `{{SKILL_DOMINIO}}`: uso para implementar y refactorizar el código de este dominio.
- `{{SKILL_TESTING}}`: uso para ejecutar y diagnosticar pruebas locales.
- `mejorar-skills`: siempre que se deba adaptar o registrar una mejora en las skills del dominio.

## Reglas e invariantes locales

- Todo caso de uso debe desacoplarse de infraestructura externa mediante interfaces.
- No inventar datos ni librerías: verificar antes de usar.

## Verificación

- Test local del dominio: `{{CMD_TEST_LOCAL}}`
- Entrega con código 0.
