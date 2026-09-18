# =====================================================================
# MUAC - Script de Instalación Automatizada para Windows (PowerShell)
# =====================================================================
$ErrorActionPreference = "Stop"

Write-Host "🪟 [MUAC] Iniciando verificación e instalación en Windows..." -ForegroundColor Cyan

# 1. Comprobar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Error: Node.js no está instalado o no se encuentra en el PATH. Instala Node.js 20+ desde https://nodejs.org/"
    exit 1
}

$nodeVer = (node -v).TrimStart('v').Split('.')[0]
if ([int]$nodeVer -lt 18) {
    Write-Error "❌ Error: Se requiere Node.js versión 18 o superior."
    exit 1
}
Write-Host "✔ Node.js detectado: $(node -v)" -ForegroundColor Green

# 2. Comprobar agy CLI
if (-not (Get-Command agy -ErrorAction SilentlyContinue) -and -not (Get-Command agy.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Advertencia: 'agy' CLI no encontrado en el PATH." -ForegroundColor Yellow
} else {
    Write-Host "✔ agy CLI detectado en el sistema." -ForegroundColor Green
}

# 3. Entorno .env
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

if (-not (Test-Path ".env")) {
    Write-Host "📄 Creando .env a partir de .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  IMPORTANTE: Configura tus credenciales de Google OAuth en .env" -ForegroundColor Yellow
}

# 4. Instalación de dependencias y compilación
Write-Host "📦 Instalando dependencias de Node.js..." -ForegroundColor Cyan
npm install

Write-Host "🧪 Ejecutando typecheck y pruebas unitarias..." -ForegroundColor Cyan
npm run typecheck
npm test

Write-Host "🏗️  Compilando aplicación de producción..." -ForegroundColor Cyan
npm run build

# 5. Configuración de servicio en segundo plano
Write-Host "⚙️  Configurando lanzador en segundo plano..." -ForegroundColor Cyan
npm run service:install

Write-Host ""
Write-Host "🎉 [MUAC] Instalación en Windows finalizada correctamente." -ForegroundColor Green
Write-Host "Para iniciar la aplicación en segundo plano ejecuta:"
Write-Host "   npm run service:start" -ForegroundColor Cyan
Write-Host "O para iniciarla en la terminal interactiva:"
Write-Host "   npm start" -ForegroundColor Cyan
Write-Host ""
