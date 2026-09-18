# 🧩 Squad de Agentes: Dominio Cuentas (`src/cuentas`)

Hereda del orquestador raíz. Escuadrón dedicado a la funcionalidad de autenticación OAuth Google, persistencia de tokens y sincronización de credenciales activas con el Secret Service del sistema.
Operas con el ciclo SDD sobre la rama dev. No orquestas ni delegas tareas globales.

## 🎯 Ámbito
- Edita únicamente dentro de `src/cuentas/**`. Fuera de ahí, detente y repórtalo al orquestador.
- Dependencias de otros dominios exclusivamente a través de `src/shared/types/`.

## 👥 Subagentes del escuadrón
- `cuentas-explorer`: examina requerimientos locales y contratos disponibles (skill `openspec-explore`).
- `cuentas-architect`: redacta propuestas locales con OpenSpec (skill `openspec-propose`).
- `cuentas-builder`: implementa lógica y tests (skill tecnológica y `openspec-apply-change`).
- `cuentas-qa`: ejecuta pruebas locales y valida el cierre (skill `openspec-archive-change`).

## 🛠️ Skills del dominio
| Tecnología o tarea local | Skill asignada | Uso |
| :--- | :--- | :--- |
| Especificación local | `openspec-propose` | Redactar la propuesta de cambio y las tareas del dominio. |
| Gestión OAuth y Secret Service | `cuentas-auth-ts` | Escribir y mantener servicios de token, D-Bus y SQLite. |
| Testing local | `cuentas-qa-node` | Ejecutar y verificar pruebas locales de cuentas. |
| Corrección de una skill | `mejorar-skills` | Cuando el usuario corrija cómo trabaja una skill de la tabla. |

## 💼 Reglas e invariantes de negocio
- El flujo OAuth DEBE incluir obligatoriamente `prompt=select_account` para evitar que el navegador reutilice automáticamente la sesión activa de Google.
- Los tokens nunca se imprimen en logs, vistas ni endpoints no autenticados.
- Sincronizar en Secret Service (`service: "gemini"`, `username: "antigravity"`) el `StoredToken` de la cuenta seleccionada.
- No inventar datos ni librerías: verificar antes de usar.

## 🧪 Verificación local
- Test del dominio: `npm run typecheck`
- Entrega solo con código 0.
