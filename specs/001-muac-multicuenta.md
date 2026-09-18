# 📋 SDD-001: Aplicación Web Multi-Cuenta Antigravity Pro (`muac`)

## 1. Problema y Objetivo
El usuario dispone de múltiples cuentas con suscripción Google AI / Antigravity Pro y necesita alternar de forma transparente entre ellas cuando se agoten las cuotas de 5 horas y/o semanales, sin interrumpir su flujo de trabajo de chat asistido por IA.

El sistema proporciona una interfaz web completa en tema oscuro con:
1. Barra de entrada de mensajes con indicador circular interactivo del contexto (aro de contexto).
2. Selector desplegable de modelos oficiales de Antigravity (`gemini-2.5-pro`, `gemini-2.5-flash`, `claude-3-7-sonnet`, `claude-3-5-sonnet`, `gpt-4o`, etc.).
3. Selector desplegable de cuentas vinculadas con visualización de disponibilidad de cuota en vivo.
4. Barra lateral izquierda colapsable con historial de hilos de conversación y acceso modal a Configuración global.
5. Configuración de inclusión/exclusión en el pool de rotación automática (`in_rotation_pool`).
6. Sincronización bidireccional segura con el Secret Service de Linux (D-Bus keyring de GNOME) para que el CLI `agy` y las herramientas del sistema reconozcan de inmediato la cuenta activa.
7. Barra de Workspace / Rutas locales de proyectos en la cabecera de chat para ejecución autónoma del modelo como agente (`--add-dir <path>` y `cwd: <path>`).
8. Panel de Permisos de Agente en la configuración global con auto-aprobación (`--dangerously-skip-permissions`), modos (`--mode accept-edits/plan`) y sandbox (`--sandbox`).
9. Rotación e iteración manual y automática de cuentas basada en límites de 5 horas y semanal.

---

## 2. Screaming Architecture y Dominios
- `src/cuentas/`: Gestión de cuentas Google OAuth (PKCE con `prompt=select_account`, `client_id` y `client_secret` oficial de Antigravity), persistencia dual de verifiers PKCE, refresco de tokens y sincronización con Linux Keyring / Secret Service (`service: gemini`, `username: antigravity`).
- `src/rotacion/`: Monitoreo de cuotas (`agy --print /usage --output-format json`), ventanas 5h/semanal, algoritmo de selección de pool, iteración forzada manual y conmutación automática con failover recursivo.
- `src/chat/`: Hilos de conversación, persistencia de `project_path`, selector interactivo de workspace con validación `/api/workspace`, cálculo de ventana de contexto para aro SVG, y puente streaming con subproceso `agy` (`step_update` y `result`).
- `src/configuracion/`: Persistencia de ajustes globales, permisos de herramientas (`dangerouslySkipPermissions`), modo de ejecución (`agentMode`), sandbox (`sandboxMode`) y ruta por defecto de proyectos.
- `src/shared/types/`: Contratos compartidos y tipado estricto (`account.ts`, `quota.ts`, `model.ts`, `chat.ts`, `settings.ts`).
- `src/shared/db.ts`: Capa de persistencia SQLite nativa (`node:sqlite`) en modo WAL con tablas `accounts`, `quota_snapshots`, `conversations`, `messages`, `settings`, `rotation_logs` y `oauth_states`.

---

## 3. Matriz de Verificación y Estado
- [x] Verificación de tipos TypeScript (`npm run typecheck` - código 0).
- [x] Compilación Next.js (`npm run build` - 11 rutas estáticas y dinámicas generadas - código 0).
- [x] Pruebas unitarias (`node --test tests/muac.test.js` - 6/6 pasadas).
- [x] Integración con D-Bus Secret Service (`keyring_bridge.py read/write`).
- [x] Prevención de colisión de sesiones OAuth (`prompt=select_account` + `client_secret`).
- [x] Gestión de rutas locales (Workspace) y validación en `/api/workspace`.
- [x] Configuración de permisos de agente y banderas nativas de `agy`.
- [x] Iteración y rotación automática ante cuotas agotadas de 5h y semanal.
