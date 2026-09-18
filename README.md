# muac (Multi-Account Antigravity Controller)

Interfaz web de chat y panel de control para Google Antigravity que conmuta entre múltiples cuentas de Google conforme se agotan las cuotas de tokens.

## Arquitectura del sistema

El proyecto divide su lógica en dominios aislados dentro de `src/`, comunicados mediante contratos tipados en `src/shared/types/`:

```text
src/
├── cuentas/          # Ciclo de vida OAuth, tokens y puente con almacenes de claves
├── rotacion/         # Monitor de cuotas de 5 horas y semanales con selector de pool
├── chat/             # Conexión con el proceso agy, sincronización y componentes web
├── configuracion/    # Ajustes persistentes y parámetros de permisos del agente
├── shared/           # Tipos compartidos, base de datos SQLite y validación de rutas
└── app/              # Enrutador App Router de Next.js y rutas de API
```

La base de datos principal reside en `data/muac.db`, gestionada con el módulo nativo `node:sqlite` de Node.js en modo WAL (`PRAGMA journal_mode = WAL;`) y claves foráneas activas. El archivo se crea con permisos `0600` para restringir el acceso al usuario que ejecuta la aplicación.

## Gestión de cuentas y sincronización de credenciales

muac gestiona múltiples identidades de Google asociadas al entorno de Antigravity.

### Flujo de autenticación OAuth 2.0 PKCE

El inicio de sesión usa el protocolo OAuth 2.0 con PKCE (Proof Key for Code Exchange) y el parámetro `prompt=select_account`, lo que permite vincular cuentas adicionales sin cerrar la sesión actual en el navegador:

1. La interfaz solicita iniciar sesión a `/api/auth/google`.
2. El servidor genera un verificador criptográfico y redirige a la pantalla de consentimiento de Google con los alcances de Antigravity.
3. El callback en `/api/auth/callback` intercambia el código de autorización por los tokens de acceso y refresco.
4. Los tokens se almacenan cifrados en la base de datos local y se sincronizan con el almacén seguro del sistema operativo.

### Sincronización con almacenes seguros

El script `src/cuentas/scripts/keyring_bridge.py` sincroniza las credenciales activas con el gestor de claves nativo antes de ejecutar cualquier comando de Antigravity:

- En Linux interactúa con el demonio Secret Service mediante D-Bus (`org.freedesktop.secrets`).
- En macOS utiliza la utilidad nativa `/usr/bin/security` para acceder a Keychain.
- En Windows utiliza Windows Credential Manager.
- Si la librería `keyring` de Python está presente en el entorno, se emplea como capa unificada.

### Cuentas pendientes de verificación

Cuando una cuenta de Google requiere aceptar términos o verificar el acceso a Antigravity, la aplicación detecta el error emitido por la API de Google, extrae el enlace oficial de verificación y marca la cuenta con el estado correspondiente para resolverlo en el navegador.

## Monitoreo de cuotas y algoritmo de rotación

La rotación automática previene interrupciones durante sesiones de trabajo prolongadas.

### Ventanas de cuota

Cada cuenta monitorea dos ventanas temporales independientes para cada modelo disponible:

- Ventana móvil de 5 horas: cupo de tokens de uso continuo.
- Ventana semanal: cupo acumulado de 7 días.

Los porcentajes de uso se recalculan periódicamente o tras cada mensaje procesado.

### Reglas de selección de cuenta

Cuando una cuenta activa alcanza un nivel residual inferior o igual al 2% en cualquiera de sus ventanas, el sistema ejecuta los siguientes pasos:

1. Marca la cuenta como agotada y actualiza su registro con la marca de tiempo exacta en que se repondrá el cupo.
2. En la interfaz, la cuenta pasa a un estado visual atenuado con fondo oscuro.
3. El algoritmo de selección busca en el pool la cuenta con mayor porcentaje de cuota disponible que no esté bloqueada ni en espera.
4. Si la cuenta seleccionada estaba agotada pero su tiempo de reinicio ya expiró, el sistema restablece automáticamente su estado al tono original y reinicia sus métricas.
5. El puente de credenciales actualiza el almacén seguro del sistema con el nuevo token antes de enviar la siguiente solicitud.

Los tiempos restantes para el restablecimiento de 5 horas y semanal se muestran en la barra de controles inferior y en la ventana de ajustes.

## Entorno de chat y sincronización con Antigravity

La interfaz de chat replica la organización y el comportamiento del cliente oficial de Antigravity, manteniendo sincronizado el historial local.

### Estructura de proyectos y conversaciones

La barra lateral divide el historial en dos niveles:

- Sección Projects: Contenedores de carpetas de proyectos y workspaces registrados (`prueba`, `IA`, `plantilla`, `CLI Project`, etc.). Cada carpeta muestra sus conversaciones indentadas con su título y tiempo relativo transcurrido (`4m`, `59m`, `6h`, `2d`). Los proyectos sin chats muestran el indicador «No conversations yet».
- Sección Conversations: Chats independientes o consultas directas que no pertenecen a ningún proyecto ni carpeta local (`outside-of-project`).
- Botón + New Conversation: Inicia un nuevo chat en la cabecera del panel lateral.
- Acciones rápidas: Anclado de chats prioritarios, filtrado y eliminación con confirmación.

### Envío y recepción de fotos, videos y archivos

Tanto el usuario como el agente pueden intercambiar contenido multimedia y documentos:

- Fotos e imágenes: Se cargan mediante el botón de adjuntos, arrastrando al chat o pegando capturas desde el portapapeles. Se muestran inline en el hilo de mensajes.
- Videos: Admite formatos mp4, webm y mov, reproduciéndose directamente mediante un reproductor integrado.
- Archivos y código: Admite documentos, hojas de cálculo y ficheros de código fuente, presentados en tarjetas con nombre, tamaño y botón de descarga.
- Conversión automática de textos extensos: Cualquier texto o bloque de código pegado o escrito que supere las 35 líneas se convierte automáticamente en un archivo adjunto de texto (`.txt`), evitando saturar el cuerpo del mensaje y facilitando su lectura por parte del agente mediante sus herramientas de lectura.

### Indicador de ventana de contexto

El indicador circular de contexto (`ContextRing`) está ubicado en la barra de controles inferior, a la izquierda del selector de cuentas y modelos:

- Calcula el porcentaje consumido frente al límite máximo de tokens del modelo en uso.
- Cuenta con protección interna contra valores no numéricos o divisiones por cero.
- Despliega un menú emergente superior con el desglose exacto de tokens utilizados, tokens totales y el porcentaje restante.

## Permisos y modos de ejecución del agente

El panel de configuración permite ajustar el grado de autonomía y las directivas del subproceso `agy`.

### Instrucciones de sistema (System Prompt) y compatibilidad de modelos

Permite definir directrices globales de comportamiento técnico para el agente, con una advertencia explícita de compatibilidad según el motor:

- Modelos compatibles: Los modelos nativos de Google Gemini (Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.1 Pro) aceptan e incorporan estas directivas en cada interacción.
- Modelos que no lo toman en cuenta: Los modelos de terceros (3P) como Claude Sonnet 4.6, Claude Opus 4.6 (Thinking) y GPT-OSS 120B ignoran el System Prompt personalizado debido a las restricciones de aislamiento del harness de Antigravity.

### Modos globales

- `--dangerously-skip-permissions`: Ejecuta las herramientas sin solicitar confirmación interactiva en terminal.
- `--mode`: Alterna entre el modo agente autónomo (`agent`) y el modo de consulta directa (`ask`).
- `--sandbox`: Activa el aislamiento en entorno protegido para comandos de sistema.

### Permisos granulares de herramientas

La configuración desglosa las capacidades del agente en opciones individuales:

- Ejecución en terminal: permiso para invocar comandos de consola (`run_command`).
- Edición de archivos: permiso para modificar o crear ficheros en el espacio de trabajo (`write_to_file`, `replace_file_content`).
- Lectura de archivos: permiso para inspeccionar código y carpetas (`view_file`, `list_dir`, `grep_search`).
- Acceso web: permiso para realizar consultas de búsqueda externa (`search_web`, `read_url_content`).
- Subagentes: permiso para definir e invocar agentes secundarios (`invoke_subagent`, `define_subagent`).

## Subproceso agy y streaming

El módulo `src/chat/agy-bridge.ts` gestiona la interacción directa con el ejecutable de Antigravity:

1. Invoca el binario `agy` pasando el prompt, el modelo seleccionado y el parámetro `--output-format stream-json`.
2. Procesa la salida estándar línea a línea interpretando eventos estructurados JSON.
3. Transmite el texto generado y el estado de ejecución de herramientas al cliente web mediante Server-Sent Events (SSE).
4. Captura errores de elegibilidad o límites de cuota devueltos por el backend de Google durante la llamada.
5. Si ocurre un fallo recuperable por cuota, conmuta a la siguiente cuenta disponible del pool sin perder la respuesta acumulada.

## Servicio en segundo plano

muac incluye un gestor unificado (`scripts/service-manager.js`) para funcionar como demonio del sistema operativo.

### Plataformas soportadas

- Linux: Servicio de usuario en systemd (`~/.config/systemd/user/muac.service`) con política de reinicio automático.
- macOS: Agente launchd (`~/Library/LaunchAgents/com.antonio.muac.plist`).
- Windows: Acceso directo en la carpeta de inicio de usuario (`shell:startup`) o servicio nativo mediante NSSM.

### Comandos de control

| Comando | Acción |
| :--- | :--- |
| `npm run service:install` | Registra y habilita el servicio en el sistema |
| `npm run service:start` | Inicia la ejecución del proceso en segundo plano |
| `npm run service:stop` | Detiene el servicio |
| `npm run service:status` | Muestra el estado del proceso y los registros recientes |

## Instalación y despliegue

### Instalación rápida por script

Linux:
```bash
./scripts/install-linux.sh
```

macOS:
```bash
./scripts/install-macos.sh
```

Windows (PowerShell con permisos de ejecución):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

### Instalación manual

#### 1. Requisitos previos

- Node.js 20 o superior (Node.js 24 recomendado para soporte nativo de `node:sqlite`).
- CLI de Antigravity (`agy`) instalado y accesible en la variable `PATH`.
- Python 3.10 o superior con cabeceras de sistema.

#### 2. Configuración de entorno

Copiar la plantilla y asignar permisos restringidos al archivo:

```bash
cp .env.example .env
chmod 600 .env
```

Completar en `.env` los valores de `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` obtenidos en Google Cloud Console.

#### 3. Dependencias según sistema operativo

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

En macOS (con Homebrew):
```bash
brew install node python
```

#### 4. Compilación y arranque

```bash
git clone git@github.com:4ntoniomj/muac.git
cd muac
npm install
npm run typecheck
npm test
npm run build
```

Para entorno de desarrollo con recarga rápida:
```bash
npm run dev
```

Para producción:
```bash
npm start
```

La consola web queda disponible en `http://localhost:3000`.

## Rutas de la API interna

| Método | Ruta | Función |
| :--- | :--- | :--- |
| `GET` | `/api/cuentas` | Lista de cuentas, estados de cuota y cuenta activa |
| `POST` | `/api/cuentas` | Registro o actualización de cuenta |
| `DELETE` | `/api/cuentas` | Eliminación de cuenta del pool |
| `POST` | `/api/cuentas/activar` | Conmutación manual de cuenta activa |
| `GET` | `/api/chat` | Lista de conversaciones agrupadas por proyecto |
| `POST` | `/api/chat` | Envío de mensaje e inicio de streaming con agy |
| `GET` | `/api/configuracion` | Lectura de configuración global y permisos de agente |
| `PUT` | `/api/configuracion` | Actualización de parámetros y permisos |
| `GET` | `/api/auth/google` | Inicio del flujo de autenticación OAuth |
| `GET` | `/api/auth/callback` | Callback de recepción de credenciales de Google |

## Seguridad

- Almacenamiento local restringido: El archivo `.env` y el directorio `data/` están excluidos del repositorio mediante `.gitignore`.
- Validación de rutas: `src/shared/path-security.ts` valida todas las rutas de trabajo contra ataques de cruce de directorios (`path traversal`).
- Cabeceras HTTP: `next.config.mjs` aplica políticas de seguridad que incluyen `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- Manejo de secretos: Las credenciales nunca se exponen al cliente web ni se escriben en los registros del servidor.

## Pruebas

Ejecutar la suite completa de tests automatizados:
```bash
npm test
```

Comprobar los tipos de TypeScript:
```bash
npm run typecheck
```

Compilar para producción:
```bash
npm run build
```

## Licencia

Código distribuido bajo licencia MIT.
