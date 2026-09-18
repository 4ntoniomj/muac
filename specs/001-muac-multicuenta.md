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

---

## 2. Screaming Architecture y Dominios
- `src/cuentas/`: Gestión de cuentas Google OAuth (PKCE con `prompt=select_account`), refresco de tokens y sincronización con Linux Keyring / Secret Service (`service: gemini`, `username: antigravity`).
- `src/rotacion/`: Monitoreo de cuotas (`agy --print /usage --output-format json`), ventanas 5h/semanal, algoritmo de selección de pool y conmutación automática.
- `src/chat/`: Hilos de conversación, cálculo de ventana de contexto para aro SVG, y puente streaming con subproceso `agy` (`step_update` y `result`).
- `src/configuracion/`: Persistencia de ajustes globales (`auto_rotation`, `switch_threshold_percent`, etc.).
- `src/shared/types/`: Contratos compartidos y tipado estricto (`account.ts`, `quota.ts`, `model.ts`, `chat.ts`, `settings.ts`).
- `src/shared/db.ts`: Capa de persistencia SQLite nativa (`node:sqlite`) en modo WAL.

---

## 3. Matriz de Verificación y Estado
- [x] Verificación de tipos TypeScript (`npm run typecheck` - código 0).
- [x] Compilación Next.js (`npm run build` - código 0).
- [x] Pruebas unitarias (`node --test tests/muac.test.js` - 4/4 pasadas).
- [x] Integración con D-Bus Secret Service (`keyring_bridge.py read/write`).
- [x] Prevención de colisión de sesiones OAuth (`prompt=select_account`).
