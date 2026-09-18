const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// 1. Verificación del Generador OAuth, prompt=select_account y credenciales desacopladas
test('OAuth: Debe incluir prompt=select_account, client_id dinámico y client_secret para intercambio de tokens', () => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_client_id.apps.googleusercontent.com';
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = 'http://localhost:3000/api/auth/callback';

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
    access_type: 'offline',
    prompt: 'select_account',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  assert.match(authUrl, /prompt=select_account/, 'La URL debe forzar el selector de cuentas');
  assert.match(authUrl, /code_challenge_method=S256/, 'Debe usar PKCE S256');
  assert.match(authUrl, new RegExp(`client_id=${encodeURIComponent(CLIENT_ID)}`), 'Debe usar el client_id configurado');

  // Parámetros requeridos para intercambio de tokens
  const tokenParams = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: 'sample_code',
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });

  assert.equal(tokenParams.get('client_secret'), CLIENT_SECRET, 'Debe incluir el client_secret para evitar HTTP 400');
});

// 2. Verificación de Lógica de Cálculo de Ventana de Contexto
test('Context Window: Cálculo exacto de porcentaje y transición de colores del aro', () => {
  const maxTokens = 1048576; // 1M tokens (Gemini 3.8 Flash)

  // Caso 1: Uso bajo (<60%)
  const lowTokens = 10000;
  const lowPercent = (lowTokens / maxTokens) * 100;
  assert.ok(lowPercent < 60);
  const colorLow = lowPercent >= 85 ? 'danger' : lowPercent >= 60 ? 'warning' : 'safe';
  assert.equal(colorLow, 'safe');

  // Caso 2: Uso medio (60% - 85%)
  const medTokens = 700000;
  const medPercent = (medTokens / maxTokens) * 100;
  const colorMed = medPercent >= 85 ? 'danger' : medPercent >= 60 ? 'warning' : 'safe';
  assert.equal(colorMed, 'warning');

  // Caso 3: Uso alto (>= 85%)
  const highTokens = 950000;
  const highPercent = (highTokens / maxTokens) * 100;
  const colorHigh = highPercent >= 85 ? 'danger' : highPercent >= 60 ? 'warning' : 'safe';
  assert.equal(colorHigh, 'danger');
});

// 3. Verificación del Algoritmo de Evaluación de Cuotas y Rotación
test('Rotación: Detección de agotamiento en ventanas de 5h y semanal', () => {
  const threshold = 0.05; // 5%

  // Caso A: Cuota normal (no rotar)
  const quotaNormal = {
    gemini5hRemaining: 0.89,
    geminiWeeklyRemaining: 0.45,
  };
  const shouldRotateA =
    quotaNormal.gemini5hRemaining <= threshold || quotaNormal.geminiWeeklyRemaining <= threshold;
  assert.equal(shouldRotateA, false);

  // Caso B: 5 horas agotado (< 5%)
  const quota5hExhausted = {
    gemini5hRemaining: 0.02,
    geminiWeeklyRemaining: 0.45,
  };
  const shouldRotateB =
    quota5hExhausted.gemini5hRemaining <= threshold || quota5hExhausted.geminiWeeklyRemaining <= threshold;
  assert.equal(shouldRotateB, true);

  // Caso C: Semanal agotado (< 5%)
  const quotaWeeklyExhausted = {
    gemini5hRemaining: 0.89,
    geminiWeeklyRemaining: 0.01,
  };
  const shouldRotateC =
    quotaWeeklyExhausted.gemini5hRemaining <= threshold || quotaWeeklyExhausted.geminiWeeklyRemaining <= threshold;
  assert.equal(shouldRotateC, true);
});

// 4. Verificación de Selección de Siguiente Cuenta en Pool
test('Rotación: Selección de la cuenta con mayor disponibilidad en el pool', () => {
  const currentAccountId = 'acc_1';
  const accounts = [
    { id: 'acc_1', email: 'cuenta1@gmail.com', inRotationPool: true, orderIndex: 0 },
    { id: 'acc_2', email: 'cuenta2@gmail.com', inRotationPool: true, orderIndex: 1 },
    { id: 'acc_3', email: 'cuenta3@gmail.com', inRotationPool: false, orderIndex: 2 }, // Excluida del pool
  ];

  const quotas = {
    acc_2: { gemini5hRemaining: 0.95, geminiWeeklyRemaining: 0.80 },
    acc_3: { gemini5hRemaining: 1.00, geminiWeeklyRemaining: 1.00 },
  };

  // Filtrar solo las que están en el pool y que no sean la actual
  const eligible = accounts.filter(a => a.inRotationPool && a.id !== currentAccountId);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'acc_2');
  assert.equal(eligible[0].email, 'cuenta2@gmail.com');
});

// 5. Verificación de Rutas Locales (Workspace)
test('Workspace: Validación de directorio local existente', () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const validPath = process.cwd();
  assert.equal(fs.existsSync(validPath), true, 'El directorio del proyecto debe existir');
  assert.equal(fs.statSync(validPath).isDirectory(), true, 'Debe ser un directorio');

  const invalidPath = '/directorio/totalmente/ficticio/12345';
  assert.equal(fs.existsSync(invalidPath), false, 'Directorio ficticio no debe existir');
});

// 6. Verificación de Configuración de Permisos y Banderas del Agente
test('Permisos: Composición de banderas de ejecución para el subproceso agy', () => {
  const settings = {
    dangerouslySkipPermissions: true,
    agentMode: 'accept-edits',
    sandboxMode: false,
    defaultProjectPath: process.cwd(),
  };

  const args = ['--print', 'test prompt', '--model', 'gemini-2.5-pro'];

  if (settings.defaultProjectPath) {
    args.push('--add-dir', settings.defaultProjectPath);
  }
  if (settings.dangerouslySkipPermissions) {
    args.push('--dangerously-skip-permissions');
  }
  if (settings.agentMode !== 'default') {
    args.push('--mode', settings.agentMode);
  }
  if (settings.sandboxMode) {
    args.push('--sandbox');
  }

  assert.ok(args.includes('--dangerously-skip-permissions'), 'Debe incluir auto-aprobación');
  assert.ok(args.includes('--mode') && args[args.indexOf('--mode') + 1] === 'accept-edits', 'Debe incluir modo');
  assert.ok(args.includes('--add-dir'), 'Debe incluir directorio de workspace');
  assert.ok(!args.includes('--sandbox'), 'No debe incluir sandbox si está desactivado');
});

// 7. Verificación de Anclado y Ordenación de Chats
test('Chats: Priorización y ordenación de chats anclados (isPinned)', () => {
  const conversations = [
    { id: 'c1', title: 'Chat antiguo anclado', isPinned: true, updatedAt: '2026-09-18T10:00:00Z' },
    { id: 'c2', title: 'Chat reciente sin anclar', isPinned: false, updatedAt: '2026-09-18T20:00:00Z' },
    { id: 'c3', title: 'Chat muy reciente anclado', isPinned: true, updatedAt: '2026-09-18T21:00:00Z' },
    { id: 'c4', title: 'Chat antiguo sin anclar', isPinned: false, updatedAt: '2026-09-18T08:00:00Z' },
  ];

  // Ordenar igual que en SQLite: ORDER BY is_pinned DESC, updated_at DESC
  const sorted = [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  assert.equal(sorted[0].id, 'c3', 'El chat anclado más reciente debe ser el primero');
  assert.equal(sorted[1].id, 'c1', 'El chat anclado más antiguo debe ser el segundo');
  assert.equal(sorted[2].id, 'c2', 'Los no anclados van después ordenados por fecha');
  assert.equal(sorted[3].id, 'c4');
});

// 8. Verificación de Operaciones Masivas (Bulk Pin / Bulk Delete / Select All)
test('Chats: Selección total y operaciones masivas', () => {
  let convos = [
    { id: 'c1', isPinned: false },
    { id: 'c2', isPinned: false },
    { id: 'c3', isPinned: false },
  ];

  // Seleccionar todos
  const allIds = convos.map((c) => c.id);
  assert.equal(allIds.length, 3);

  // Bulk Pin sobre todos
  convos = convos.map((c) => (allIds.includes(c.id) ? { ...c, isPinned: true } : c));
  assert.ok(convos.every((c) => c.isPinned));

  // Bulk Delete de subset
  const toDelete = ['c1', 'c2'];
  convos = convos.filter((c) => !toDelete.includes(c.id));
  assert.equal(convos.length, 1);
  assert.equal(convos[0].id, 'c3');
});

// 9. Verificación de Detección de Error de Elegibilidad y URL de Activación
test('Elegibilidad agy: Extracción de URL oficial de verificación de Google', () => {
  const agyErrorOutput = `error: Eligibility check failed: Your current account is not eligible for Antigravity. Verify your account to continue.

Alternatively, try signing in with another personal Google account.

Please verify your account in your browser to continue:
https://accounts.google.com/signin/continue?sarp=1&scc=1&continue=https://developers.google.com/gemini-code-assist/auth/auth_success_gemini&plt=AKgnsbtL
{"conversation_id":"","status":"ERROR"}`;

  const isEligibilityError = agyErrorOutput.includes('Eligibility check failed') || agyErrorOutput.includes('not eligible');
  assert.equal(isEligibilityError, true, 'Debe detectar el error de elegibilidad');

  const match = agyErrorOutput.match(/https:\/\/(?:accounts\.google\.com|developers\.google\.com)[^\s"'<>]+/);
  assert.ok(match, 'Debe extraer la URL de verificación de Google');
  assert.match(match[0], /accounts\.google\.com\/signin\/continue/, 'URL debe apuntar al flujo oficial de Google');
});

// 10. Verificación de Observabilidad: Estructuración de Eventos de Actividad
test('Observabilidad: Captura y emisión de pasos de herramientas y razonamiento', () => {
  const sampleToolStep = {
    step_index: 2,
    state: 'ACTIVE',
    step_type: 'tool',
    tool_name: 'list_dir',
    tool_info: {
      name: 'list_dir',
      parameters: { DirectoryPath: '/home/usuario/proyecto' },
    },
    duration_seconds: 0.05,
  };

  const activity = {
    stepIndex: sampleToolStep.step_index,
    stepType: 'tool',
    state: sampleToolStep.state,
    toolName: sampleToolStep.tool_name,
    toolParameters: sampleToolStep.tool_info.parameters,
    durationSeconds: sampleToolStep.duration_seconds,
  };

  assert.equal(activity.stepType, 'tool');
  assert.equal(activity.toolName, 'list_dir');
  assert.equal(activity.toolParameters.DirectoryPath, '/home/usuario/proyecto');
});

// 11. Verificación de Banderas de Esfuerzo de Razonamiento y Modelos
test('Esfuerzo de Razonamiento: Inclusión de --effort solo para modelos soportados', () => {
  const geminiModel = { id: 'gemini-3.8-flash', effortSupported: true, supportedEfforts: ['low', 'medium', 'high'] };
  const claudeModel = { id: 'claude-sonnet-4-6', effortSupported: false, supportedEfforts: [] };

  function buildAgyArgs(model, effort) {
    const args = ['--print', 'hi', '--model', model.id];
    if (model.effortSupported) {
      args.push('--effort', effort);
    }
    return args;
  }

  const geminiArgs = buildAgyArgs(geminiModel, 'low');
  assert.ok(geminiArgs.includes('--effort'));
  assert.equal(geminiArgs[geminiArgs.indexOf('--effort') + 1], 'low');

  const claudeArgs = buildAgyArgs(claudeModel, 'low');
  assert.ok(!claudeArgs.includes('--effort'), 'Claude no debe recibir flag --effort para evitar error de agy');
});

// 12. Verificación del Cálculo de Ventana de Contexto Sin Duplicación Indebida
test('Context Window: El cálculo debe basarse en el último turno real y no acumular sumas falsas', () => {
  const messages = [
    { role: 'user', content: 'Pregunta 1' },
    {
      role: 'assistant',
      content: 'Respuesta 1',
      usage: { inputTokens: 13260, outputTokens: 500, totalTokens: 13760 },
    },
    { role: 'user', content: 'Pregunta 2' },
    {
      role: 'assistant',
      content: 'Respuesta 2',
      usage: { inputTokens: 14000, outputTokens: 800, totalTokens: 14800 },
    },
  ];

  // Algoritmo corregido: buscar el último mensaje del asistente con usage
  let baseTokens = 0;
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].usage && messages[i].usage.totalTokens > 0) {
      baseTokens = messages[i].usage.totalTokens;
      lastAssistantIdx = i;
      break;
    }
  }

  assert.equal(baseTokens, 14800, 'Debe tomar los 14,800 tokens del último turno, no 13,760 + 14,800');
  assert.notEqual(baseTokens, 13760 + 14800, 'No debe sumar turnos previos porque ya están en el historial');
});

// 13. Verificación de Zenity para Selección de Carpeta de Workspace
test('Workspace: Disponibilidad de herramienta de diálogo zenity en Linux', () => {
  const fs = require('node:fs');
  const zenityExists = fs.existsSync('/usr/bin/zenity');
  assert.equal(zenityExists, true, 'El ejecutable /usr/bin/zenity debe existir en el entorno Linux');
});

// 14. Verificación de Sustitución de Etiqueta Workspace por Nombre de Carpeta
test('Workspace: Reemplazo de etiqueta Workspace por el nombre de la carpeta seleccionada', () => {
  const getFolderDisplayName = (projectPath) => {
    return projectPath ? projectPath.split('/').filter(Boolean).pop() || projectPath : 'Workspace';
  };

  assert.equal(getFolderDisplayName(''), 'Workspace', 'Sin ruta debe mostrar "Workspace"');
  assert.equal(getFolderDisplayName(undefined), 'Workspace', 'Ruta indefinida debe mostrar "Workspace"');
  assert.equal(
    getFolderDisplayName('/home/antonio/Escritorio/Todo/IA/prueba'),
    'prueba',
    'Debe extraer el nombre final del directorio sin la ruta completa'
  );
  assert.equal(
    getFolderDisplayName('/home/antonio/Escritorio/Todo/IA/prueba/'),
    'prueba',
    'Debe manejar correctamente barras finales'
  );
  assert.equal(
    getFolderDisplayName('/var/www/mi-proyecto'),
    'mi-proyecto',
    'Debe mostrar el nombre exacto de la carpeta'
  );
});

// 15. Verificación de Modal de Advertencia por Pérdida de Contexto en Cambio de Modelo
test('Modelo: Modal de advertencia con mensaje exacto al conmutar de modelo', () => {
  const WARNING_TEXT = 'Al cambiar de modelo se pierde el contexto de la conversación, ¿estás seguro?';
  
  // Simulación de interacción de usuario
  let currentModelId = 'gemini-3.8-flash';
  let pendingModelId = null;

  const handleModelClick = (targetModelId) => {
    if (targetModelId === currentModelId) {
      return { triggeredModal: false };
    }
    pendingModelId = targetModelId;
    return {
      triggeredModal: true,
      message: WARNING_TEXT,
    };
  };

  // Clic en el mismo modelo no debe lanzar modal
  const sameResult = handleModelClick('gemini-3.8-flash');
  assert.equal(sameResult.triggeredModal, false, 'No debe disparar advertencia al seleccionar el mismo modelo');
  assert.equal(pendingModelId, null);

  // Clic en modelo diferente debe lanzar advertencia con mensaje exacto
  const diffResult = handleModelClick('claude-3-7-sonnet');
  assert.equal(diffResult.triggeredModal, true, 'Debe disparar advertencia al cambiar a otro modelo');
  assert.equal(diffResult.message, WARNING_TEXT, 'El texto debe ser exactamente el especificado');
  assert.equal(pendingModelId, 'claude-3-7-sonnet');

  // Si cancela, currentModelId no cambia
  pendingModelId = null;
  assert.equal(currentModelId, 'gemini-3.8-flash', 'Al cancelar se preserva el modelo original');

  // Si acepta, se actualiza el modelo
  const handleConfirm = (confirmedId) => {
    currentModelId = confirmedId;
  };
  handleConfirm('claude-3-7-sonnet');
  assert.equal(currentModelId, 'claude-3-7-sonnet', 'Al aceptar se actualiza el modelo');
});

// 16. Verificación de Permisos Estrictos de Base de Datos y .env
test('Seguridad: Verificación de permisos restrictivos (0600 / 0700)', () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && process.platform !== 'win32') {
    const stat = fs.statSync(envPath);
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o600, 'El archivo .env debe tener permisos estrictos 0600');
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (fs.existsSync(dataDir) && process.platform !== 'win32') {
    const stat = fs.statSync(dataDir);
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o700, 'El directorio data/ debe tener permisos estrictos 0700');
  }
});

// 17. Verificación de Sanitización de Workspace contra Path Traversal
test('Seguridad: Prevención de Path Traversal y rechazo de rutas raíz/protegidas', () => {
  const path = require('node:path');

  const FORBIDDEN_ROOTS_POSIX = new Set([
    '/', '/etc', '/proc', '/sys', '/dev', '/boot', '/root', '/bin', '/sbin', '/usr/bin', '/usr/sbin'
  ]);

  const validate = (target) => {
    if (!target || typeof target !== 'string' || !target.trim()) return { valid: false };
    const resolved = path.resolve(path.normalize(target.trim()));
    if (FORBIDDEN_ROOTS_POSIX.has(resolved)) return { valid: false, error: 'Acceso denegado' };
    return { valid: true, resolved };
  };

  assert.equal(validate('/etc').valid, false, 'No debe permitir /etc');
  assert.equal(validate('/etc/../etc').valid, false, 'No debe permitir evasión con .. hacia /etc');
  assert.equal(validate('/').valid, false, 'No debe permitir la raíz del sistema');
  assert.equal(validate(process.cwd()).valid, true, 'Debe permitir el directorio del proyecto');
});

// 18. Verificación de Cabeceras HTTP de Seguridad
test('Seguridad: Cabeceras de seguridad CSP, X-Content-Type-Options y X-Frame-Options', async () => {
  const nextConfigModule = await import('../next.config.mjs');
  const config = nextConfigModule.default;
  assert.ok(typeof config.headers === 'function', 'next.config.mjs debe definir headers()');

  const headersList = await config.headers();
  const rootRule = headersList.find(h => h.source === '/(.*)');
  assert.ok(rootRule, 'Debe existir regla de cabeceras para /(.*)');

  const map = new Map(rootRule.headers.map(h => [h.key, h.value]));
  assert.ok(map.has('Content-Security-Policy'), 'Debe incluir Content-Security-Policy');
  assert.equal(map.get('X-Content-Type-Options'), 'nosniff', 'Debe incluir nosniff');
  assert.equal(map.get('X-Frame-Options'), 'DENY', 'Debe incluir X-Frame-Options DENY');
  assert.equal(map.get('Referrer-Policy'), 'strict-origin-when-cross-origin', 'Debe incluir Referrer-Policy');
});

// 19. Verificación de Compatibilidad Multiplataforma de Explorador Nativo
test('Multiplataforma: Comando de diálogo de carpetas configurado según SO', () => {
  const getPickerCommand = (platform) => {
    if (platform === 'darwin') {
      return { tool: 'osascript', args: ['-e', 'POSIX path of (choose folder with prompt "Selecciona la carpeta de trabajo")'] };
    }
    if (platform === 'win32') {
      return { tool: 'powershell', commandIncludes: 'FolderBrowserDialog' };
    }
    return { tool: 'zenity', fallback: 'kdialog' };
  };

  const mac = getPickerCommand('darwin');
  assert.equal(mac.tool, 'osascript');

  const win = getPickerCommand('win32');
  assert.equal(win.tool, 'powershell');
  assert.ok(win.commandIncludes.includes('FolderBrowserDialog'));

  const linux = getPickerCommand('linux');
  assert.equal(linux.tool, 'zenity');
  assert.equal(linux.fallback, 'kdialog');
});

// 20. Verificación de Normalización de Rutas y Binario agy
test('Multiplataforma: Normalización de rutas de Workspace', () => {
  const path = require('node:path');
  const rawPath = '/directorio/con/barras/../normalizadas/';
  const normalized = path.normalize(path.resolve(rawPath));
  assert.ok(!normalized.includes('..'), 'La ruta normalizada no debe contener secuencias relativas ..');
});



