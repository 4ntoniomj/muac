# 🧩 Squad de Agentes: Dominio Rotación (`src/rotacion`)

Hereda del orquestador raíz. Escuadrón dedicado al monitoreo de cuotas de 5 horas y semanales de Antigravity Pro, y al algoritmo de conmutación automática de cuentas en el pool de iteración.
Operas con el ciclo SDD sobre la rama dev. No orquestas ni delegas tareas globales.

## 🎯 Ámbito
- Edita únicamente dentro de `src/rotacion/**`. Fuera de ahí, detente y repórtalo al orquestador.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## 👥 Subagentes del escuadrón
- `rotacion-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `rotacion-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `rotacion-builder`: implementa lógica y tests (skill tecnológica y `openspec-apply-change`).
- `rotacion-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## 🛠️ Skills del dominio
| Tecnología o tarea local | Skill asignada | Uso |
| :--- | :--- | :--- |
| Especificación local | `openspec-propose` | Redactar la propuesta de cambio y las tareas del dominio. |
| Algoritmos de rotación y cuotas | `rotacion-pool-ts` | Lógica de pool, cálculo de cuotas y conmutación. |
| Testing local | `rotacion-qa-node` | Ejecutar pruebas unitarias de failover y cuotas. |
| Corrección de una skill | `mejorar-skills` | Cuando el usuario corrija cómo trabaja una skill de la tabla. |

## 💼 Reglas e invariantes de negocio
- La lectura de cuotas se realiza con `agy --print /usage --output-format json` para obtener datos 100% reales.
- Solo las cuentas con `inRotationPool = true` participan en la rotación automática.
- Si una cuenta agota su cuota de 5h o semanal (o devuelve 429), se activa la siguiente cuenta en orden de prioridad con cuota disponible.
- Se registra un `RotationEvent` para auditar cuándo y por qué ocurrió la conmutación.

## 🧪 Verificación local
- Test del dominio: `npm run typecheck`
- Entrega solo con código 0.
