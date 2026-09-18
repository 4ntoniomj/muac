# muac (Multi-Account Antigravity Controller)

Interfaz web de chat y consola de agente para Google Antigravity que rota automáticamente entre varias cuentas de Google cuando se agota la cuota de tokens.

## Funciones principales

- Rotación de cuentas: Conmuta a otra cuenta del pool cuando la cuenta activa alcanza el límite de tokens en su ventana de 5 horas o semanal. También permite cambiar de cuenta manualmente en cualquier momento.
- Indicador de contexto: Un aro sobre la barra de entrada muestra el porcentaje de tokens usados en la conversación y cambia de color según el consumo.
- Directorio de trabajo local: Selector de carpeta en la barra de mensajes que valida la ruta y comprueba si contiene un repositorio Git.
- Opciones de agente: Controles para autoaprobar permisos (`--dangerously-skip-permissions`), seleccionar el modo de edición y activar aislamiento en sandbox.
- Gestión de conversaciones: Permite anclar chats al inicio de la lista, borrarlos con confirmación o realizar acciones en bloque seleccionando varias conversaciones.
- Autenticación con Google: Inicio de sesión OAuth 2.0 con PKCE forzando el selector de cuentas (`prompt=select_account`), y sincronización con el almacén seguro del sistema operativo (Linux Secret Service, macOS Keychain o Windows Credential Manager).
- Detección de cuentas pendientes: Si una cuenta requiere verificación en Antigravity, la aplicación detecta el enlace oficial de Google para completarla en una pestaña nueva.

## Instalación rápida

El repositorio incluye scripts que comprueban dependencias, instalan paquetes de npm, compilan la aplicación y configuran el servicio del sistema:

En Linux:
```bash
./scripts/install-linux.sh
# O descarga y ejecución en un comando:
# bash <(curl -fsSL https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-linux.sh)
```

En macOS:
```bash
./scripts/install-macos.sh
# O descarga y ejecución en un comando:
# bash <(curl -fsSL https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-macos.sh)
```

En Windows (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
# O descarga y ejecución en un comando:
# irm https://raw.githubusercontent.com/4ntoniomj/muac/dev/scripts/install-windows.ps1 | iex
```

## Servicio en segundo plano

muac incluye un gestor para ejecutarse como demonio o servicio de fondo según el sistema operativo:

- Linux: Servicio de usuario en systemd (`~/.config/systemd/user/muac.service`) con reinicio automático.
- macOS: Agente launchd (`~/Library/LaunchAgents/com.antonio.muac.plist`).
- Windows: Lanzador en segundo plano en la carpeta de inicio (`shell:startup`) o mediante NSSM.

Comandos de gestión:

| Comando | Acción |
| :--- | :--- |
| `npm run service:install` | Registra y activa el servicio en el sistema |
| `npm run service:start` | Inicia el servicio |
| `npm run service:stop` | Detiene el servicio |
| `npm run service:status` | Muestra el estado del servicio y sus registros |

## Instalación manual

### Requisitos previos

- Node.js 20 o superior (recomendado Node.js 24, que incluye `node:sqlite`).
- CLI de Antigravity (`agy`) accesible en la terminal.
- Python 3.10 o superior (para los puentes del sistema de claves).

### Configuración del entorno

Copia la plantilla de variables de entorno y asigna permisos de lectura solo para tu usuario:

```bash
cp .env.example .env
chmod 600 .env
```

Edita `.env` con tu `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

### Linux (Ubuntu, Debian, Fedora, Arch)

1. Dependencias del sistema:

En Ubuntu o Debian:
```bash
sudo apt update
sudo apt install -y python3 python3-dbus libsecret-tools zenity
```

En Fedora:
```bash
sudo dnf install -y python3 python3-dbus libsecret zenity
```

En Arch Linux:
```bash
sudo pacman -S python python-dbus libsecret zenity
```

2. Instalación y compilación:
```bash
git clone git@github.com:4ntoniomj/muac.git
cd muac
npm install
npm run typecheck
npm test
npm run build
```

3. Ejecución:
- Desarrollo: `npm run dev`
- Producción: `npm start`

La aplicación queda disponible en `http://localhost:3000`.

### macOS

1. Dependencias con Homebrew:
```bash
brew install node python
```

2. Instalación y compilación:
```bash
cd muac
npm install
npm run build
npm start
```

### Windows

En Windows puedes ejecutar la aplicación de forma nativa o mediante WSL2:

1. Ejecución nativa con PowerShell:
```powershell
npm install
npm run build
npm start
```

2. Ejecución en WSL2 (Ubuntu):
Instala Ubuntu con `wsl --install -d Ubuntu` y sigue los pasos de la sección de Linux.

## Estructura del proyecto

El código está organizado por áreas de negocio:

```text
src/
├── cuentas/          # Gestión de cuentas Google, OAuth PKCE y sincronización con almacenes seguros
├── rotacion/         # Monitoreo de cuotas y cálculo de disponibilidad del pool
├── chat/             # Conexión con agy, ventana de contexto y componentes de chat
├── configuracion/    # Ajustes persistentes y parámetros del agente
├── shared/           # Tipos compartidos, base de datos SQLite y utilidades de ruta
└── app/              # Rutas de Next.js App Router y endpoints de API
```

## Detalles técnicos

### Base de datos local
Utiliza el módulo nativo `node:sqlite` de Node.js en modo WAL (`PRAGMA journal_mode = WAL;`) y claves foráneas activadas. La base de datos reside en `data/muac.db` con permisos `0600` y está excluida del control de versiones.

### Sincronización de credenciales
El archivo `src/cuentas/scripts/keyring_bridge.py` sincroniza el token activo antes de que el CLI `agy` sea invocado. En Linux interactúa con el Secret Service por D-Bus; en macOS utiliza `/usr/bin/security`; en Windows utiliza Windows Credential Manager. Si la librería `keyring` de Python está instalada, se utiliza como capa unificada.

### Subproceso agy
El módulo `src/chat/agy-bridge.ts` lanza `agy` con `--output-format stream-json`. Procesa línea a línea los eventos JSON y emite texto y actividades de herramientas mediante Server-Sent Events (SSE). Si Google devuelve un error de elegibilidad, extrae la URL de verificación y conmuta a la siguiente cuenta disponible del pool.

### Seguridad y cabeceras HTTP
`next.config.mjs` define cabeceras estrictas de seguridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`. Las rutas de workspace son verificadas con `src/shared/path-security.ts` para evitar accesos fuera de directorios permitidos.

## Pruebas

Ejecuta la suite de pruebas unitarias:
```bash
npm test
```

Comprobación de tipos con TypeScript:
```bash
npm run typecheck
```

Compilación de producción:
```bash
npm run build
```

## Licencia

Distribuido bajo la licencia MIT.
