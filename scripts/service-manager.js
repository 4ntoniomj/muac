#!/usr/bin/env node

/**
 * Gestor unificado de servicio en segundo plano (Daemon) para MUAC.
 * Soporta Linux (systemd user unit), macOS (launchd plist) y Windows (startup/NSSM).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const ACTION = process.argv[2] || 'status';
const PLATFORM = process.platform;
const PROJECT_DIR = path.resolve(__dirname, '..');
const HOME_DIR = os.homedir();
const NODE_BIN = process.execPath;
const PORT = process.env.PORT || '3000';

function run(cmd, ignoreErrors = false) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (ignoreErrors) return '';
    throw err;
  }
}

// --- LINUX (systemd user unit) ---
const SYSTEMD_USER_DIR = path.join(HOME_DIR, '.config/systemd/user');
const SYSTEMD_SERVICE_FILE = path.join(SYSTEMD_USER_DIR, 'muac.service');

function linuxInstall() {
  if (!fs.existsSync(SYSTEMD_USER_DIR)) {
    fs.mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
  }

  const nextBin = path.join(PROJECT_DIR, 'node_modules/.bin/next');
  const unitContent = `[Unit]
Description=MUAC - Multi-Account Antigravity Controller
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_BIN} ${nextBin} start --port ${PORT}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=${process.env.PATH}

[Install]
WantedBy=default.target
`;

  fs.writeFileSync(SYSTEMD_SERVICE_FILE, unitContent, 'utf-8');
  run('systemctl --user daemon-reload');
  run('systemctl --user enable --now muac.service');
  console.log(`✅ [Linux] Servicio instalado y activado en: ${SYSTEMD_SERVICE_FILE}`);
  console.log('   Comandos útiles:');
  console.log('     systemctl --user status muac.service');
  console.log('     systemctl --user stop muac.service');
  console.log('     journalctl --user -u muac.service -f');
}

function linuxStart() {
  run('systemctl --user start muac.service');
  console.log('✅ [Linux] Servicio muac iniciado.');
}

function linuxStop() {
  run('systemctl --user stop muac.service');
  console.log('🛑 [Linux] Servicio muac detenido.');
}

function linuxStatus() {
  try {
    const status = run('systemctl --user status muac.service --no-pager');
    console.log(status);
  } catch (err) {
    console.log('ℹ️  [Linux] El servicio no está activo o no está instalado.');
    if (err.stdout) console.log(err.stdout);
  }
}

function linuxUninstall() {
  run('systemctl --user disable --now muac.service', true);
  if (fs.existsSync(SYSTEMD_SERVICE_FILE)) {
    fs.unlinkSync(SYSTEMD_SERVICE_FILE);
  }
  run('systemctl --user daemon-reload', true);
  console.log('🗑️  [Linux] Servicio desinstalado.');
}

// --- MACOS (launchd agent) ---
const LAUNCH_AGENTS_DIR = path.join(HOME_DIR, 'Library/LaunchAgents');
const PLIST_FILE = path.join(LAUNCH_AGENTS_DIR, 'com.antonio.muac.plist');
const LOGS_DIR = path.join(HOME_DIR, 'Library/Logs');

function macosInstall() {
  if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
    fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const nextBin = path.join(PROJECT_DIR, 'node_modules/.bin/next');
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.antonio.muac</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${nextBin}</string>
        <string>start</string>
        <string>--port</string>
        <string>${PORT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOGS_DIR}/muac.log</string>
    <key>StandardErrorPath</key>
    <string>${LOGS_DIR}/muac.error.log</string>
</dict>
</plist>
`;

  fs.writeFileSync(PLIST_FILE, plistContent, 'utf-8');
  run(`launchctl unload -w "${PLIST_FILE}"`, true);
  run(`launchctl load -w "${PLIST_FILE}"`);
  console.log(`✅ [macOS] Agente de fondo instalado en: ${PLIST_FILE}`);
  console.log(`   Logs: ${LOGS_DIR}/muac.log`);
}

function macosStart() {
  run('launchctl start com.antonio.muac');
  console.log('✅ [macOS] Agente iniciado.');
}

function macosStop() {
  run('launchctl stop com.antonio.muac');
  console.log('🛑 [macOS] Agente detenido.');
}

function macosStatus() {
  try {
    const list = run('launchctl list | grep com.antonio.muac');
    console.log('✅ [macOS] Agente activo:');
    console.log(list);
  } catch {
    console.log('ℹ️  [macOS] El agente com.antonio.muac no se encuentra en ejecución.');
  }
}

function macosUninstall() {
  run(`launchctl unload -w "${PLIST_FILE}"`, true);
  if (fs.existsSync(PLIST_FILE)) {
    fs.unlinkSync(PLIST_FILE);
  }
  console.log('🗑️  [macOS] Agente desinstalado.');
}

// --- WINDOWS (Startup background runner / NSSM) ---
const WIN_STARTUP_DIR = path.join(
  process.env.APPDATA || path.join(HOME_DIR, 'AppData/Roaming'),
  'Microsoft/Windows/Start Menu/Programs/Startup'
);
const WIN_VBS_FILE = path.join(WIN_STARTUP_DIR, 'muac-service.vbs');
const WIN_BAT_FILE = path.join(PROJECT_DIR, 'scripts/muac-runner.bat');

function windowsInstall() {
  const nextBin = path.join(PROJECT_DIR, 'node_modules/next/dist/bin/next');
  const batContent = `@echo off
cd /d "${PROJECT_DIR}"
set NODE_ENV=production
"${NODE_BIN}" "${nextBin}" start --port ${PORT}
`;
  fs.writeFileSync(WIN_BAT_FILE, batContent, 'utf-8');

  // VBScript para ejecución completamente silenciosa en segundo plano
  const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${WIN_BAT_FILE}" & chr(34), 0
Set WshShell = Nothing
`;
  if (fs.existsSync(WIN_STARTUP_DIR)) {
    fs.writeFileSync(WIN_VBS_FILE, vbsContent, 'utf-8');
    console.log(`✅ [Windows] Lanzador en segundo plano instalado en Inicio: ${WIN_VBS_FILE}`);
  } else {
    console.log(`✅ [Windows] Archivo de servicio generado en: ${WIN_BAT_FILE}`);
  }
  console.log('   Para ejecutarlo como servicio de Windows nativo con NSSM:');
  console.log(`     nssm install MUAC "${NODE_BIN}" "${nextBin}" start --port ${PORT}`);
  console.log(`     nssm set MUAC AppDirectory "${PROJECT_DIR}"`);
  console.log('     nssm start MUAC');
}

function windowsStart() {
  if (fs.existsSync(WIN_VBS_FILE)) {
    run(`wscript.exe "${WIN_VBS_FILE}"`);
    console.log('✅ [Windows] Servicio iniciado en segundo plano.');
  } else if (fs.existsSync(WIN_BAT_FILE)) {
    run(`start /b cmd /c "${WIN_BAT_FILE}"`);
    console.log('✅ [Windows] Servicio iniciado.');
  } else {
    console.log('❌ Ejecuta primero: npm run service:install');
  }
}

function windowsStop() {
  run('taskkill /F /IM node.exe /FI "WINDOWTITLE eq muac*"', true);
  console.log('🛑 [Windows] Procesos de servicio detenidos.');
}

function windowsStatus() {
  try {
    const out = run('tasklist /FI "IMAGENAME eq node.exe"');
    console.log(out);
  } catch {
    console.log('ℹ️  No se encontraron procesos de Node.js en ejecución.');
  }
}

function windowsUninstall() {
  if (fs.existsSync(WIN_VBS_FILE)) {
    fs.unlinkSync(WIN_VBS_FILE);
  }
  console.log('🗑️  [Windows] Servicio desinstalado de la carpeta Inicio.');
}

// --- DESPACHADOR PRINCIPAL ---
switch (ACTION) {
  case 'install':
    if (PLATFORM === 'linux') linuxInstall();
    else if (PLATFORM === 'darwin') macosInstall();
    else if (PLATFORM === 'win32') windowsInstall();
    else linuxInstall();
    break;

  case 'start':
    if (PLATFORM === 'linux') linuxStart();
    else if (PLATFORM === 'darwin') macosStart();
    else if (PLATFORM === 'win32') windowsStart();
    else linuxStart();
    break;

  case 'stop':
    if (PLATFORM === 'linux') linuxStop();
    else if (PLATFORM === 'darwin') macosStop();
    else if (PLATFORM === 'win32') windowsStop();
    else linuxStop();
    break;

  case 'status':
    if (PLATFORM === 'linux') linuxStatus();
    else if (PLATFORM === 'darwin') macosStatus();
    else if (PLATFORM === 'win32') windowsStatus();
    else linuxStatus();
    break;

  case 'uninstall':
    if (PLATFORM === 'linux') linuxUninstall();
    else if (PLATFORM === 'darwin') macosUninstall();
    else if (PLATFORM === 'win32') windowsUninstall();
    else linuxUninstall();
    break;

  default:
    console.error(`Comando desconocido: "${ACTION}". Acciones válidas: install, start, stop, status, uninstall`);
    process.exit(1);
}
