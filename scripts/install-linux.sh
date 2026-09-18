#!/usr/bin/env bash
# =====================================================================
# MUAC - Script de Instalación Automatizada para Linux
# =====================================================================
set -e

echo "🚀 [MUAC] Iniciando verificación e instalación en Linux..."

# 1. Comprobar Node.js >= 18
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js no está instalado. Instala Node.js >= 20 (recomendado Node.js 24)."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Se requiere Node.js versión 18 o superior (actual: $(node -v))."
  exit 1
fi
echo "✔ Node.js detectado: $(node -v)"

# 2. Comprobar agy CLI
if ! command -v agy &> /dev/null; then
  echo "⚠️  Advertencia: 'agy' CLI de Antigravity no se encontró en el PATH."
  echo "   Asegúrate de instalar o vincular agy antes de iniciar sesiones con la IA."
else
  echo "✔ agy CLI detectado en: $(which agy)"
fi

# 3. Comprobar Python 3 y herramientas de GUI
if command -v python3 &> /dev/null; then
  echo "✔ Python 3 detectado: $(python3 --version)"
else
  echo "⚠️  Advertencia: python3 no encontrado. Necesario para sincronizar credenciales."
fi

if ! command -v zenity &> /dev/null && ! command -v kdialog &> /dev/null; then
  echo "ℹ️  Nota: Ni 'zenity' ni 'kdialog' están instalados. El explorador nativo de carpetas usará selección manual si no se instalan."
fi

# 4. Configurar .env a partir de .env.example si no existe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  echo "📄 Creando .env desde .env.example..."
  cp .env.example .env
  chmod 600 .env
  echo "⚠️  IMPORTANTE: Edita .env con tus credenciales de Google OAuth."
else
  chmod 600 .env
fi

# 5. Instalar dependencias y compilar
echo "📦 Instalando dependencias de Node.js..."
npm install

echo "🧪 Ejecutando verificación de tipos y pruebas..."
npm run typecheck
npm test

echo "🏗️  Compilando build optimizada de Next.js..."
npm run build

echo ""
echo "🎉 [MUAC] Instalación y compilación completada con éxito."
echo ""
echo "Para iniciar manualmente:"
echo "   npm start"
echo ""
echo "Para instalar y activar como servicio de fondo persistente (systemd):"
echo "   npm run service:install"
echo ""
