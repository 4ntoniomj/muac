#!/usr/bin/env bash
# =====================================================================
# MUAC - Script de Instalación Automatizada para macOS
# =====================================================================
set -e

echo "🍏 [MUAC] Iniciando verificación e instalación en macOS..."

# 1. Comprobar Node.js >= 18
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js no está instalado. Instálalo mediante: brew install node"
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
  echo "⚠️  Advertencia: 'agy' CLI no encontrado en PATH."
else
  echo "✔ agy CLI detectado en: $(which agy)"
fi

# 3. Configuración de variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  echo "📄 Creando .env desde .env.example..."
  cp .env.example .env
  chmod 600 .env
  echo "⚠️  IMPORTANTE: Configura tus credenciales en el archivo .env"
else
  chmod 600 .env
fi

# 4. Instalar y compilar
echo "📦 Instalando dependencias..."
npm install

echo "🧪 Verificando tipos y suite de pruebas..."
npm run typecheck
npm test

echo "🏗️  Compilando build de producción..."
npm run build

echo ""
echo "🎉 [MUAC] Instalación en macOS completada con éxito."
echo ""
echo "Para iniciar en primer plano:"
echo "   npm start"
echo ""
echo "Para registrar y activar el servicio en segundo plano (launchd):"
echo "   npm run service:install"
echo ""
