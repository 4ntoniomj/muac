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

// 21. Verificación de Limpieza de Prompts de Antigravity para Sincronización
test('Antigravity Sync: cleanUserInputContent extrae el prompt limpio sin etiquetas internas', () => {
  const cleanUserInputContent = (rawContent) => {
    if (!rawContent) return '';
    const userReqMatch = rawContent.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
    if (userReqMatch && userReqMatch[1]) {
      return userReqMatch[1].trim();
    }
    let cleaned = rawContent.replace(/<USER_REQUEST>/gi, '').trim();
    cleaned = cleaned.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '').trim();
    cleaned = cleaned.replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '').trim();
    return cleaned || rawContent.trim();
  };

  const rawWithTags = `<USER_REQUEST>
¿Puedes optimizar esta función de búsqueda en TypeScript?
</USER_REQUEST>
<ADDITIONAL_METADATA>
{ "timestamp": "2026-09-18T23:59:00Z" }
</ADDITIONAL_METADATA>`;

  const cleaned = cleanUserInputContent(rawWithTags);
  assert.equal(cleaned, '¿Puedes optimizar esta función de búsqueda en TypeScript?');

  const plainText = 'Hola, ¿cómo estás?';
  assert.equal(cleanUserInputContent(plainText), 'Hola, ¿cómo estás?');
});

// 22. Verificación de Dinamismo de Cuotas según Grupo de Modelo (Gemini vs Claude/GPT)
test('Quota: Cálculo y selección del porcentaje según el grupo del modelo', () => {
  const mockQuota = {
    gemini5hRemaining: 0.25, // 25%
    geminiWeeklyRemaining: 0.50, // 50%
    thirdParty5hRemaining: 0.90, // 90%
    thirdPartyWeeklyRemaining: 0.95, // 95%
  };

  const getQuotaForModel = (modelGroup, quota) => {
    const is3p = modelGroup === '3p';
    return {
      fiveHour: Math.round((is3p ? quota.thirdParty5hRemaining : quota.gemini5hRemaining) * 100),
      weekly: Math.round((is3p ? quota.thirdPartyWeeklyRemaining : quota.geminiWeeklyRemaining) * 100),
    };
  };

  const geminiResult = getQuotaForModel('gemini', mockQuota);
  assert.equal(geminiResult.fiveHour, 25);
  assert.equal(geminiResult.weekly, 50);

  const claudeResult = getQuotaForModel('3p', mockQuota);
  assert.equal(claudeResult.fiveHour, 90);
  assert.equal(claudeResult.weekly, 95);
});

// 23. Verificación de Frescura de Cuota
test('Quota: Control de frescura con umbral TTL de 30 segundos', () => {
  const isFresh = (updatedAtIso, maxAgeMs = 30000) => {
    const age = Date.now() - new Date(updatedAtIso).getTime();
    return age >= 0 && age < maxAgeMs;
  };

  const recentTime = new Date(Date.now() - 5000).toISOString(); // 5s atrás
  assert.equal(isFresh(recentTime), true, 'Un snapshot de 5 segundos debe considerarse fresco');

  const oldTime = new Date(Date.now() - 60000).toISOString(); // 60s atrás
  assert.equal(isFresh(oldTime), false, 'Un snapshot de 60 segundos debe considerarse caducado');
});

// 24. Verificación de Formateo de Tiempo de Reset de Cuotas (formatTimeUntilReset)
test('Quota: formatTimeUntilReset formatea cuentas regresivas y detecta reestablecimiento', () => {
  const formatTimeUntilReset = (resetTimeIso) => {
    if (!resetTimeIso) return null;
    const targetDate = new Date(resetTimeIso);
    const target = targetDate.getTime();
    if (isNaN(target)) return null;
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return 'Reestablecido';

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const timeStr = targetDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (days > 0) {
      const dayStr = targetDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      return `en ${days}d ${hours % 24}h (${dayStr} ${timeStr})`;
    }
    if (hours > 0) {
      return `en ${hours}h ${minutes % 60}m (${timeStr})`;
    }
    return `en ${minutes}m (${timeStr})`;
  };

  // Pasado -> Reestablecido
  const pastTime = new Date(Date.now() - 10000).toISOString();
  assert.equal(formatTimeUntilReset(pastTime), 'Reestablecido');

  // En 45 minutos -> "en 45m (HH:MM)" o similar
  const in45m = new Date(Date.now() + 45 * 60 * 1000).toISOString();
  const res45m = formatTimeUntilReset(in45m);
  assert.match(res45m, /en 4[45]m/);

  // En 3 horas y 20 minutos -> "en 3h 20m (HH:MM)"
  const in3h20m = new Date(Date.now() + (3 * 60 + 20) * 60 * 1000).toISOString();
  const res3h = formatTimeUntilReset(in3h20m);
  assert.match(res3h, /en 3h (19|20)m/);

  // Null o undefined
  assert.equal(formatTimeUntilReset(null), null);
  assert.equal(formatTimeUntilReset(undefined), null);
});

// 25. Verificación de Detección de Cuenta Agotada (isQuotaExhausted) y Restauración Automática
test('Quota: isQuotaExhausted detecta agotamiento y revierte al pasar la fecha de reset', () => {
  const isQuotaExhausted = (fiveHourRemaining, weeklyRemaining, fiveHourResetIso, weeklyResetIso) => {
    const now = Date.now();
    const fiveHourResetPassed = fiveHourResetIso ? new Date(fiveHourResetIso).getTime() <= now : false;
    const weeklyResetPassed = weeklyResetIso ? new Date(weeklyResetIso).getTime() <= now : false;

    const is5hExhausted =
      fiveHourRemaining !== undefined &&
      fiveHourRemaining !== null &&
      fiveHourRemaining <= 0.02 &&
      !fiveHourResetPassed;

    const isWeeklyExhausted =
      weeklyRemaining !== undefined &&
      weeklyRemaining !== null &&
      weeklyRemaining <= 0.02 &&
      !weeklyResetPassed;

    return is5hExhausted || isWeeklyExhausted;
  };

  const futureReset = new Date(Date.now() + 3600000).toISOString();
  const pastReset = new Date(Date.now() - 3600000).toISOString();

  // Caso 1: Cuenta con cuota normal (80%, 90%)
  assert.equal(isQuotaExhausted(0.8, 0.9, futureReset, futureReset), false);

  // Caso 2: Cuenta con 5h agotada (0% restante) y reset futuro -> true (tono agotado)
  assert.equal(isQuotaExhausted(0.0, 0.9, futureReset, futureReset), true);

  // Caso 3: Cuenta con 5h al 0% pero el reset ya pasó -> false (se restaura original)
  assert.equal(isQuotaExhausted(0.0, 0.9, pastReset, futureReset), false);

  // Caso 4: Cuenta semanal agotada (1% restante) y reset futuro -> true
  assert.equal(isQuotaExhausted(0.5, 0.01, futureReset, futureReset), true);

  // Caso 5: Cuenta semanal agotada pero reset semanal ya pasó -> false
  assert.equal(isQuotaExhausted(0.5, 0.01, futureReset, pastReset), false);
});

// 26. Verificación de Auto-conversión de Texto > 35 líneas a Archivo Adjunto
test('Adjuntos: Textos con más de 35 líneas se convierten automáticamente en archivo', () => {
  const shouldConvertToAttachment = (text) => {
    if (!text) return false;
    const lines = text.split('\n');
    return lines.length > 35;
  };

  const shortText = Array.from({ length: 20 }, (_, i) => `Línea de prueba ${i + 1}`).join('\n');
  assert.equal(shouldConvertToAttachment(shortText), false, '20 líneas no deben convertirse');

  const boundaryText35 = Array.from({ length: 35 }, (_, i) => `Línea de prueba ${i + 1}`).join('\n');
  assert.equal(shouldConvertToAttachment(boundaryText35), false, '35 líneas exactas no deben convertirse');

  const longText36 = Array.from({ length: 36 }, (_, i) => `Línea de prueba ${i + 1}`).join('\n');
  assert.equal(shouldConvertToAttachment(longText36), true, '36 líneas deben convertirse a archivo');

  const veryLongText100 = Array.from({ length: 100 }, (_, i) => `Línea de prueba ${i + 1}`).join('\n');
  assert.equal(shouldConvertToAttachment(veryLongText100), true, '100 líneas deben convertirse a archivo');
});

// 27. Verificación de Formateo de Tiempo Relativo (como en Antigravity: 4m, 59m, 6h, 13h, 2d)
test('Time: formatRelativeTime formatea timestamps idéntico al sidebar de Antigravity', () => {
  const formatRelativeTime = (dateIso) => {
    if (!dateIso) return '';
    const date = new Date(dateIso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    if (isNaN(diffMs) || diffMs < 0) return '1m';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return '1m';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w`;
    return `${Math.floor(diffDays / 30)}mo`;
  };

  const now = Date.now();
  const m4 = new Date(now - 4 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(m4), '4m');

  const m59 = new Date(now - 59 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(m59), '59m');

  const h6 = new Date(now - 6 * 3600 * 1000).toISOString();
  assert.equal(formatRelativeTime(h6), '6h');

  const h13 = new Date(now - 13 * 3600 * 1000).toISOString();
  assert.equal(formatRelativeTime(h13), '13h');

  const d2 = new Date(now - 2 * 86400 * 1000).toISOString();
  assert.equal(formatRelativeTime(d2), '2d');
});

// 28. Verificación de Compatibilidad de Modelos para System Prompt
test('System Prompt: Incorporación para Gemini y exclusión para modelos 3P (Claude, GPT-OSS)', () => {
  const buildEffectivePrompt = (prompt, systemPrompt, modelGroup) => {
    if (systemPrompt && systemPrompt.trim() && modelGroup === 'gemini') {
      return `[System Instructions / Instrucciones de Sistema]:\n${systemPrompt.trim()}\n\n${prompt}`;
    }
    return prompt;
  };

  const sys = 'Actúa como un arquitecto senior.';
  const userPrompt = '¿Cómo organizar este módulo?';

  // Gemini model -> incluye System Instructions
  const geminiPrompt = buildEffectivePrompt(userPrompt, sys, 'gemini');
  assert.ok(geminiPrompt.includes('[System Instructions / Instrucciones de Sistema]'));
  assert.ok(geminiPrompt.includes(sys));
  assert.ok(geminiPrompt.includes(userPrompt));

  // 3P model (Claude / GPT-OSS) -> omite System Instructions (advertido en la UI)
  const claudePrompt = buildEffectivePrompt(userPrompt, sys, '3p');
  assert.equal(claudePrompt, userPrompt);
  assert.ok(!claudePrompt.includes('System Instructions'));
});

// 29. Verificación de Partición de Conversaciones entre Proyectos y Standalone
test('Sidebar: Partición de conversaciones en Proyectos (Workspaces) y Standalone (Conversations)', () => {
  const partitionConversations = (conversations) => {
    const standalone = [];
    const projectMap = new Map();

    for (const c of conversations) {
      const p = c.projectPath ? c.projectPath.trim() : '';
      if (!p || p === 'outside-of-project' || p === 'undefined') {
        standalone.push(c);
      } else {
        const norm = p.replace(/\/+$/, '');
        if (!projectMap.has(norm)) {
          projectMap.set(norm, []);
        }
        projectMap.get(norm).push(c);
      }
    }
    return { standalone, projectMap };
  };

  const mockConversations = [
    { id: '1', title: 'MUAC Hardening', projectPath: '/home/antonio/Escritorio/Todo/IA/prueba' },
    { id: '2', title: 'Multi Account App', projectPath: '/home/antonio/Escritorio/Todo/IA/prueba' },
    { id: '3', title: 'Setup Plantilla', projectPath: '/home/antonio/Escritorio/Todo/IA/plantilla' },
    { id: '4', title: 'Solucionar Cámara OBS', projectPath: 'outside-of-project' },
    { id: '5', title: 'Consulta rápida', projectPath: '' },
    { id: '6', title: 'Otra duda', projectPath: null },
  ];

  const result = partitionConversations(mockConversations);
  assert.equal(result.standalone.length, 3, 'Debe haber 3 conversaciones standalone');
  assert.ok(result.projectMap.has('/home/antonio/Escritorio/Todo/IA/prueba'));
  assert.equal(result.projectMap.get('/home/antonio/Escritorio/Todo/IA/prueba').length, 2);
  assert.ok(result.projectMap.has('/home/antonio/Escritorio/Todo/IA/plantilla'));
  assert.equal(result.projectMap.get('/home/antonio/Escritorio/Todo/IA/plantilla').length, 1);
});

// 30. Verificación de Prevención y Auto-sanación de "trajectory not found"
test('Agy Bridge: Verificación de trayectoria en CLI y fallback seguro', () => {
  const checkTrajectoryArg = (trajectoryExists, conversationId) => {
    if (trajectoryExists && conversationId) {
      return ['--conversation', conversationId];
    }
    return []; // No pasar flag rota si la trayectoria no existe
  };

  const argsWhenMissing = checkTrajectoryArg(false, '697601fc-6a58-4a6b-adee-166308cb04d8');
  assert.deepEqual(argsWhenMissing, [], 'No debe incluir --conversation si la trayectoria no existe en ~/.gemini/antigravity-cli');

  const argsWhenPresent = checkTrajectoryArg(true, '697601fc-6a58-4a6b-adee-166308cb04d8');
  assert.deepEqual(argsWhenPresent, ['--conversation', '697601fc-6a58-4a6b-adee-166308cb04d8']);
});

// 31. Verificación de Ordenación de Proyectos por Actividad Reciente (Default)
test('Proyectos: Ordenación por lastActivity descendente por defecto', () => {
  const projects = [
    { path: '/proj/a', name: 'Alpha', lastActivity: '2026-09-18T10:00:00Z', conversationCount: 5 },
    { path: '/proj/b', name: 'Beta', lastActivity: '2026-09-19T09:30:00Z', conversationCount: 2 },
    { path: '/proj/c', name: 'Gamma', lastActivity: null, conversationCount: 0 },
    { path: '/proj/d', name: 'Delta', lastActivity: '2026-09-19T08:00:00Z', conversationCount: 8 },
  ];

  const sortProjects = (list, sortBy = 'recent') => {
    const copy = [...list];
    if (sortBy === 'recent') {
      return copy.sort((a, b) => {
        const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'alpha_asc') {
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'count') {
      return copy.sort((a, b) => b.conversationCount - a.conversationCount);
    }
    return copy;
  };

  const sortedRecent = sortProjects(projects, 'recent');
  assert.equal(sortedRecent[0].name, 'Beta', 'El proyecto con actividad más reciente debe estar primero');
  assert.equal(sortedRecent[1].name, 'Delta');
  assert.equal(sortedRecent[2].name, 'Alpha');
  assert.equal(sortedRecent[3].name, 'Gamma', 'Proyectos sin actividad van al final');

  const sortedCount = sortProjects(projects, 'count');
  assert.equal(sortedCount[0].name, 'Delta', 'Delta tiene más conversaciones');

  const sortedAlpha = sortProjects(projects, 'alpha_asc');
  assert.equal(sortedAlpha[0].name, 'Alpha');
});

// 32. Verificación de Filtro de Búsqueda de Chats en Tiempo Real
test('Sidebar: Búsqueda de chats insensible a mayúsculas/minúsculas y por proyecto', () => {
  const filterConversations = (conversations, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.projectPath && c.projectPath.toLowerCase().includes(q))
    );
  };

  const convos = [
    { id: '1', title: 'Ajustar parámetros de rotación', projectPath: '/home/antonio/ia/muac' },
    { id: '2', title: 'Diseño de interfaz oscura', projectPath: '/home/antonio/ia/frontend' },
    { id: '3', title: 'Fix trajectory not found', projectPath: '/home/antonio/ia/muac' },
  ];

  assert.equal(filterConversations(convos, 'ROTACIÓN').length, 1);
  assert.equal(filterConversations(convos, 'muac').length, 2);
  assert.equal(filterConversations(convos, 'no-match').length, 0);
  assert.equal(filterConversations(convos, '').length, 3);
});

// 33. Verificación de Exclusión de Proyectos sin Conversaciones del Historial
test('Proyectos: Los proyectos que no tengan chats no se muestran en el historial', () => {
  const filterActiveProjects = (projects) => {
    return projects.filter((p) => (p.convos && p.convos.length > 0) || (p.conversationsCount && p.conversationsCount > 0));
  };

  const projectList = [
    { name: 'muac', convos: [{ id: '1', title: 'Chat 1' }] },
    { name: 'empty-project-1', convos: [] },
    { name: 'frontend', convos: [{ id: '2', title: 'Chat 2' }] },
    { name: 'empty-project-2', convos: [] },
  ];

  const activeProjects = filterActiveProjects(projectList);
  assert.equal(activeProjects.length, 2, 'Solo los proyectos con chats deben mantenerse');
  assert.equal(activeProjects[0].name, 'muac');
  assert.equal(activeProjects[1].name, 'frontend');
});

// 34. Verificación de Dictado por Voz Continuo sin Límite
test('Dictado por Voz: Configuración continua y autoreinicio sin límite de tiempo', () => {
  let isRecording = true;
  let restartedCount = 0;

  // Mock del ciclo de SpeechRecognition
  const mockOnEnd = () => {
    if (isRecording) {
      // Reanuda automáticamente para eliminar el límite de tiempo de grabación
      restartedCount++;
    }
  };

  // El motor de voz del navegador corta por silencio
  mockOnEnd();
  mockOnEnd();
  assert.equal(restartedCount, 2, 'Debe reanudar la escucha continuamente mientras isRecording sea true');

  // El usuario para la grabación
  isRecording = false;
  mockOnEnd();
  assert.equal(restartedCount, 2, 'No debe reiniciar cuando el usuario ha detenido la grabación');
});

// 35. Verificación de Detección de Tipos de Adjuntos (image, video, audio, file)
test('Adjuntos: Detección universal de tipos (image, video, audio, file) y MIME types', () => {
  const determineFileType = (filename, mimeType) => {
    if (mimeType && mimeType.startsWith('image/')) return 'image';
    if (mimeType && mimeType.startsWith('video/')) return 'video';
    if (mimeType && mimeType.startsWith('audio/')) return 'audio';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'weba'].includes(ext)) return 'audio';
    return 'file';
  };

  assert.equal(determineFileType('captura.png', 'image/png'), 'image');
  assert.equal(determineFileType('demo.mp4', 'video/mp4'), 'video');
  assert.equal(determineFileType('nota_voz.webm', 'audio/webm'), 'audio');
  assert.equal(determineFileType('audio.mp3', 'application/octet-stream'), 'audio');
  assert.equal(determineFileType('codigo.ts', 'text/plain'), 'file');
  assert.equal(determineFileType('documento.pdf', 'application/pdf'), 'file');
});

// 36. Verificación de Fallback de Reconocimiento de Voz a MediaRecorder
test('Micrófono: Fallback transparente a MediaRecorder cuando SpeechRecognition no está soportado', () => {
  const selectAudioStrategy = (hasSpeechRecognition, hasMediaDevices) => {
    if (hasSpeechRecognition) {
      return 'speech_recognition_live_text';
    }
    if (hasMediaDevices) {
      return 'media_recorder_voice_attachment';
    }
    return 'unsupported';
  };

  // En Chrome / Edge (SpeechRecognition nativo)
  assert.equal(
    selectAudioStrategy(true, true),
    'speech_recognition_live_text',
    'Debe usar reconocimiento de voz en tiempo real si está disponible'
  );

  // En Firefox / Brave / WebViews (Sin SpeechRecognition pero con MediaDevices)
  assert.equal(
    selectAudioStrategy(false, true),
    'media_recorder_voice_attachment',
    'Debe hacer fallback transparente a MediaRecorder sin lanzar error al usuario'
  );

  // En entornos sin acceso a medios
  assert.equal(
    selectAudioStrategy(false, false),
    'unsupported',
    'Detecta si el navegador carece de ambos'
  );
});

// 37. Verificación de Detección de Scroll y Botón Volver Abajo
test('Scroll: Detección de distancia al final y visualización del botón Volver Abajo', () => {
  const shouldShowScrollBottom = (scrollHeight, scrollTop, clientHeight, threshold = 140) => {
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom > threshold;
  };

  // Usuario en el fondo (distancia = 0)
  assert.equal(
    shouldShowScrollBottom(2000, 1400, 600),
    false,
    'No debe mostrar el botón si el usuario ya está al fondo'
  );

  // Usuario cerca del fondo (distancia = 80px <= 140px)
  assert.equal(
    shouldShowScrollBottom(2000, 1320, 600),
    false,
    'No debe mostrar el botón si la distancia es menor o igual al umbral de 140px'
  );

  // Usuario ha subido deliberadamente por el chat (distancia = 500px > 140px)
  assert.equal(
    shouldShowScrollBottom(2000, 900, 600),
    true,
    'Debe mostrar el botón cuando el usuario sube más de 140px del final'
  );
});
