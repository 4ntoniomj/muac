# 🧩 Squad de Agentes: Dominio {{DOMINIO}} (`src/{{DOMINIO}}`)

Hereda del orquestador raíz. Escuadrón dedicado a la funcionalidad {{DOMINIO}}.
Operas con el ciclo SDD sobre la rama dev. No orquestas ni delegas tareas globales.

## 🎯 Ámbito

- Edita únicamente dentro de `src/{{DOMINIO}}/**`. Fuera de ahí, detente y repórtalo al orquestador.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## 👥 Subagentes del escuadrón

- `{{DOMINIO}}-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `{{DOMINIO}}-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `{{DOMINIO}}-builder`: implementa lógica y tests (skill tecnológica y `openspec-apply-change`).
- `{{DOMINIO}}-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## 🛠️ Skills del dominio

| Tecnología o tarea local | Skill asignada | Uso |
| :--- | :--- | :--- |
| Especificación local | `openspec-propose` | Redactar la propuesta de cambio y las tareas del dominio. |
| {{TECNOLOGIA_DEL_MODULO}} | `{{SKILL_DOMINIO}}` | Escribir y refactorizar el código de este dominio. |
| Testing local | `{{SKILL_TESTING}}` | Ejecutar y diagnosticar las pruebas de `src/{{DOMINIO}}`. |
| Corrección de una skill | `mejorar-skills` | Cuando el usuario corrija cómo trabaja una skill de la tabla. |

Si falta la skill de una tecnología de la tabla, detente y pide al orquestador que la cree con `crear-skills`.

## 💼 Reglas e invariantes de negocio

- {{REGLAS_ESPECIFICAS_DEL_DOMINIO}}
- Todo caso de uso se desacopla de la infraestructura externa mediante interfaces.
- No inventar datos ni librerías: verificar antes de usar.

## 🧪 Verificación local

- Test del dominio: `{{CMD_TEST_LOCAL}}`
- Entrega solo con código 0.
