# 🧩 Squad de Agentes: Dominio Chat (`src/chat`)

Hereda del orquestador raíz. Escuadrón dedicado al hilo de conversación, persistencia de mensajes, motor de streaming NDJSON/SSE con `agy`, y cálculo visual de la ventana de contexto para el aro interactivo.
Operas con el ciclo SDD sobre la rama dev. No orquestas ni delegas tareas globales.

## 🎯 Ámbito
- Edita únicamente dentro de `src/chat/**`. Fuera de ahí, detente y repórtalo al orquestador.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## 👥 Subagentes del escuadrón
- `chat-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `chat-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `chat-builder`: implementa lógica y tests (skill tecnológica y `openspec-apply-change`).
- `chat-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## 🛠️ Skills del dominio
| Tecnología o tarea local | Skill asignada | Uso |
| :--- | :--- | :--- |
| Especificación local | `openspec-propose` | Redactar la propuesta de cambio y las tareas del dominio. |
| Streaming y UI de Chat | `chat-streaming-ts` | Motor de ejecución con agy, SSE y componentes de chat. |
| Testing local | `chat-qa-node` | Pruebas de cálculo de ventana de contexto y streaming. |
| Corrección de una skill | `mejorar-skills` | Cuando el usuario corrija cómo trabaja una skill de la tabla. |

## 💼 Reglas e invariantes de negocio
- El aro de la ventana de contexto debe reflejar de forma reactiva los tokens consumidos frente al límite máximo del modelo activo.
- Las respuestas del modelo se transmiten en tiempo real vía Server-Sent Events (SSE).
- Los errores de cuota (`exhausted quota` o código 429) activan automáticamente el motor de rotación para continuar la conversación con la siguiente cuenta del pool sin pérdida de contexto.

## 🧪 Verificación local
- Test del dominio: `npm run typecheck`
- Entrega solo con código 0.
