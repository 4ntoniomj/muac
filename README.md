# μac · Multi-Account Antigravity Controller

> Aplicación web moderna y robusta para interacción continua con la inteligencia artificial de **Google Antigravity Pro**, diseñada para eliminar las interrupciones por agotamiento de cuotas mediante la **iteración y rotación automática** entre múltiples cuentas de Google.

---

## 📋 Descripción Resumida

**μac** (`muac`) actúa como una interfaz avanzada de chat y consola de agente conectada directamente al motor de Antigravity CLI (`agy`). Permite gestionar un grupo de cuentas de Google vinculadas con suscripción Antigravity Pro, monitoreando en tiempo real las ventanas de cuota de **5 horas** y **semanales**. 

Cuando la cuenta activa agota sus tokens en cualquiera de las ventanas, el sistema conmuta automáticamente a la siguiente cuenta disponible del pool sin perder el hilo de la conversación ni interrumpir el trabajo del usuario.

### Características Principales

- 🔄 **Pool de Rotación Automática**: Conmutación transparente entre cuentas al alcanzar umbrales críticos de uso (5 horas o semanal) y conmutación manual inmediata en un clic.
- ⭕ **Aro de Ventana de Contexto**: Indicador visual circular en tiempo real sobre la barra de mensajes que calcula el consumo de tokens y el estado de la ventana de contexto (zona segura, advertencia o peligro).
- 📁 **Workspace Integrado en Barra de Entrada**: Selector de directorio de trabajo local ubicado directamente en la barra de redacción, con validación de existencia, conteo de archivos y detección de repositorios Git.
- 🤖 **Modos y Permisos de Agente**: Configuración de auto-aprobación de permisos (`--dangerously-skip-permissions`), modos de ejecución (`accept-edits`, `plan`) y aislamiento en sandbox (`--sandbox`).
- 📌 **Gestión Avanzada de Chats**:
  - Anclado de conversaciones al inicio del panel lateral con distintivo visual.
  - Botón de confirmación segura ("Asegurar eliminación") contra pérdidas accidentales.
  - Selección múltiple con barra flotante para anclar, desanclar o eliminar en bloque.
  - Control de "Seleccionar todos" con un solo clic para operaciones masivas.
- 🔐 **Autenticación Dual OAuth 2.0 PKCE y Secret Service**: Soporte para vincular cuentas directamente con Google forzando selector de cuentas (`prompt=select_account`) y sincronización nativa con el Secret Service del sistema operativo.
- 🚀 **Activación Directa en Google**: Detección inteligente de cuentas pendientes de validación en Antigravity y redirección en nueva pestaña para completar la verificación oficial en un clic.

---

## 🚀 Instalación Rápida (Un Solo Comando)

Ejecuta el script automatizado para tu sistema operativo. El instalador verifica los requisitos previos, instala dependencias, ejecuta la suite de pruebas, compila la aplicación y configura opcionalmente el servicio en segundo plano:

### 🐧 Linux
```bash
./scripts/install-linux.sh
# O descarga y ejecución en un comando:
# bash <(curl -fsSL https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-linux.sh)
```

### 🍏 macOS
```bash
./scripts/install-macos.sh
# O descarga y ejecución en un comando:
# bash <(curl -fsSL https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-macos.sh)
```

### 🪟 Windows (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
# O descarga y ejecución directa:
# irm https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-windows.ps1 | iex
```

---

## ⚙️ Gestión Unificada del Servicio en Segundo Plano (Daemon)

`muac` incluye un gestor de servicio multiplataforma que se adapta al demonio nativo de tu sistema operativo:
- **Linux**: Servicio de usuario systemd (`~/.config/systemd/user/muac.service`) con `Restart=always`.
- **macOS**: Agente launchd (`~/Library/LaunchAgents/com.antonio.muac.plist`) con `RunAtLoad=true` y `KeepAlive=true`.
- **Windows**: Lanzador invisible de fondo en la carpeta de Inicio (`shell:startup`) o servicio NSSM.

| Comando | Acción |
| :--- | :--- |
| `npm run service:install` | Registra y activa el daemon nativo en el sistema |
| `npm run service:start` | Inicia el servicio en segundo plano |
| `npm run service:stop` | Detiene la ejecución del servicio |
| `npm run service:status` | Comprueba el estado de ejecución y logs |

---

## 💻 Compatibilidad e Instalación por Sistema Operativo

### Requisitos Previos Generales

- **Node.js**: Versión 20.x o superior (Recomendado **Node.js 24+**, que incluye el módulo nativo de base de datos `node:sqlite`).
- **Antigravity CLI (`agy`)**: Instalado y disponible globalmente en tu terminal (`which agy`).
- **Python**: Versión 3.10 o superior (para los puentes del sistema).

---

### 🐧 1. Instalación en Linux (Ubuntu / Debian / Fedora / Arch)

Linux es el entorno principal de ejecución nativa, aprovechando la integración directa con el Secret Service de Freedesktop (`org.freedesktop.secrets` / GNOME Keyring / KWallet).

#### Paso 1: Instalar dependencias del sistema

En **Ubuntu / Debian**:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-dbus libsecret-tools
```

En **Fedora**:
```bash
sudo dnf install -y python3 python3-dbus libsecret
```

En **Arch Linux**:
```bash
sudo pacman -S python python-dbus libsecret
```

#### Paso 2: Clonar y compilar la aplicación

```bash
git clone https://github.com/usuario/prueba.git muac
cd muac

# Instalar dependencias de Node.js
npm install

# Comprobar tipos
npm run typecheck

# Ejecutar suite de pruebas unitarias
npm test

# Compilar build optimizada de producción
npm run build
```

#### Paso 3: Puesta en marcha

Para desarrollo:
```bash
npm run dev
```

Para producción:
```bash
npm start
```
Accede en tu navegador a `http://localhost:3000`.

---

### 🍏 2. Instalación en macOS (Apple Silicon / Intel)

En macOS, `muac` interactúa con el CLI `agy` y gestiona las sesiones locales a través de la base de datos interna SQLite.

#### Paso 1: Requisitos previos con Homebrew

```bash
brew install node python
```
Verifica que `agy` esté accesible:
```bash
which agy
agy --version
```

#### Paso 2: Puesta en marcha

```bash
cd muac
npm install
npm run build
npm start
```

---

### 🪟 3. Instalación en Windows (mediante WSL2)

Dado que `agy` y la sincronización con el Secret Service de credenciales requieren primitivas POSIX y D-Bus, la recomendación oficial en Windows es **WSL2** (Windows Subsystem for Linux):

1. Abre PowerShell como Administrador e instala Ubuntu:
   ```powershell
   wsl --install -d Ubuntu
   ```
2. Inicia la terminal de Ubuntu en WSL2 y sigue los mismos pasos descritos en la sección **1. Instalación en Linux**.
3. Abre el navegador de Windows en `http://localhost:3000`.

---

## 🏗️ Arquitectura Técnica del Proyecto

El código sigue estrictamente los principios de **Screaming Architecture** y separación por dominios de negocio:

```text
src/
├── cuentas/          # Dominio: Gestión de cuentas, OAuth PKCE y sincronización de credenciales
│   ├── components/   # AccountSelector
│   ├── scripts/      # keyring_bridge.py (puente D-Bus Secret Service)
│   ├── account-store.ts
│   ├── keyring-sync.ts
│   └── oauth-service.ts
│
├── rotacion/         # Dominio: Monitoreo de cuotas y algoritmo de iteración
│   ├── quota-monitor.ts
│   └── rotation-engine.ts
│
├── chat/             # Dominio: Streaming con agy, ventana de contexto y mensajería
│   ├── components/   # ChatCanvas, Sidebar, WorkspaceSelector, ModelSelector, ContextRing
│   ├── agy-bridge.ts
│   ├── chat-store.ts
│   └── context-calc.ts
│
├── configuracion/    # Dominio: Parámetros del sistema y permisos del agente
│   ├── components/   # SettingsModal
│   └── settings-store.ts
│
├── shared/           # Contratos globales y persistencia única
│   ├── types/        # Modelos de datos compartidos (account, chat, model, quota, settings)
│   └── db.ts         # Motor SQLite WAL unificado (node:sqlite)
│
└── app/              # Enrutamiento Next.js App Router y API Endpoints
    ├── api/          # Endpoints REST y SSE de cuentas, chat, conversaciones, cuotas y workspace
    ├── layout.tsx
    └── page.tsx
```

---

## ⚙️ Especificaciones Técnicas de los Módulos

### 1. Motor de Persistencia (SQLite WAL)
- Utiliza la biblioteca oficial nativa `node:sqlite` de Node.js (cero dependencias externas C++).
- Modo **WAL** (`PRAGMA journal_mode = WAL;`) con claves foráneas activadas (`PRAGMA foreign_keys = ON;`) para soportar lecturas y escrituras concurrentes de alta velocidad.
- Almacena cuentas, snapshots de cuotas, registros de rotación histórica, conversaciones, mensajes y estados temporales de autenticación OAuth.

### 2. Puente de Secret Service (`keyring_bridge.py`)
- Ubicado en `src/cuentas/scripts/keyring_bridge.py`.
- Se comunica directamente a través del bus de sesión D-Bus (`org.freedesktop.secrets`) con la colección `login` en los atributos `service="gemini"`, `username="antigravity"`.
- Permite leer y escribir atómicamente el payload JSON del `StoredToken` antes de que el CLI `agy` sea invocado.

### 3. Puente de Streaming con Antigravity (`src/chat/agy-bridge.ts`)
- Spawnea procesos `agy` bajo demanda con formato `--output-format stream-json`.
- Parsea línea a línea los eventos NDJSON:
  - `step_update`: Extrae `text_delta` para transmisión fluida vía Server-Sent Events (SSE) y actualiza tokens en vivo.
  - `result`: Captura duración, resumen final de tokens y estados de terminación.
- **Manejo de Fallos y Elegibilidad**: Si Google reporta `Eligibility check failed`, extrae la URL de verificación de Google y conmuta de manera automática a otra cuenta saludable del pool de rotación.

### 4. Algoritmo de Rotación de Cuentas (`src/rotacion/rotation-engine.ts`)
- Evalúa el porcentaje restante en dos cubos: `gemini-5h` (ventana móvil de 5 horas) y `gemini-weekly` (ventana semanal de cuota Pro).
- Cuando el porcentaje restante cae por debajo del umbral de seguridad configurado (por defecto 5%), la cuenta se marca como agotada y el motor selecciona la cuenta con mayor saldo del pool.

### 5. Barra Inferior y Selector de Workspace (`src/chat/components/workspace-selector.tsx`)
- Ubicado directamente en los controles de redacción junto al selector de modelo y cuenta.
- Valida directorios en tiempo real contra `/api/workspace` mediante estadísticas del sistema de archivos (`fs.statSync`), conteo de archivos no ignorados y presencia de repositorio Git (`.git`).

---

## 🧪 Pruebas y Validación de Calidad

El proyecto incluye suites completas de verificación:

### Ejecución de Tests Unitarios
```bash
npm test
```
Verifica:
1. Intercambio de tokens Google OAuth con PKCE y credenciales oficiales.
2. Cálculo de porcentajes y transiciones de color del Aro de Contexto.
3. Algoritmo de detección de cuotas límite de 5h y semanales.
4. Selección óptima de cuentas en el pool de rotación.
5. Validación de rutas locales de Workspace.
6. Composición de banderas de ejecución para el subproceso `agy`.
7. Priorización y ordenación de chats anclados (`is_pinned`).
8. Operaciones masivas sobre conversaciones (`bulk_pin`, `bulk_delete`).
9. Detección de errores de elegibilidad y extracción de URL oficial de verificación de Google.

### Comprobación de Tipos Estricta
```bash
npm run typecheck
```

### Compilación de Producción
```bash
npm run build
```

---

## 📄 Licencia

Este proyecto se distribuye bajo los términos y condiciones de la licencia del proyecto.
