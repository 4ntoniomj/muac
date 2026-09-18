# 🧩 Squad de Agentes: Dominio Configuración (`src/configuracion`)

Hereda del orquestador raíz. Escuadrón dedicado a la persistencia y gestión de parámetros globales de la aplicación muac (instrucciones, modelo preferido, temperatura, reglas de rotación y configuración visual).
Operas con el ciclo SDD sobre la rama dev. No orquestas ni delegas tareas globales.

## 🎯 Ámbito
- Edita únicamente dentro de `src/configuracion/**`. Fuera de ahí, detente y repórtalo al orquestador.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## 👥 Subagentes del escuadrón
- `configuracion-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `configuracion-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `configuracion-builder`: implementa lógica y tests (skill tecnológica y `openspec-apply-change`).
- `configuracion-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## 🛠️ Skills del dominio
| Tecnología o tarea local | Skill asignada | Uso |
| :--- | :--- | :--- |
| Especificación local | `openspec-propose` | Redactar la propuesta de cambio y las tareas del dominio. |
| Gestión de configuración | `configuracion-store-ts` | Almacenamiento y sincronización de preferencias. |
| Testing local | `configuracion-qa-node` | Validación de persistencia y valores por defecto. |
| Corrección de una skill | `mejorar-skills` | Cuando el usuario corrija cómo trabaja una skill de la tabla. |

## 💼 Reglas e invariantes de negocio
- La configuración es **global y compartida**: cambiar de cuenta activa no altera las preferencias de usuario, modelos ni reglas del pool.
- El setting especial del pool de rotación permite marcar y desmarcar qué cuentas participan en la conmutación automática.
- Las preferencias se persisten de inmediato en SQLite.

## 🧪 Verificación local
- Test del dominio: `npm run typecheck`
- Entrega solo con código 0.
