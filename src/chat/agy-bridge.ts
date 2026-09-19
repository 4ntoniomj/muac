import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getActiveAccount, getAccountById } from '@/cuentas/account-store';
import { syncStoredTokenToSystem } from '@/cuentas/keyring-sync';
import { evaluateQuotaExhaustion, executeAutoRotation } from '@/rotacion/rotation-engine';
import { fetchCurrentQuota } from '@/rotacion/quota-monitor';
import { getGlobalSettings } from '@/configuracion/settings-store';
import { findModel } from '@/shared/types/model';
import type { MessageUsage } from '@/shared/types/chat';
import { getAgyCommand, normalizeWorkspacePath } from '@/shared/agy-cli';
import { validateSafeWorkspacePath } from '@/shared/path-security';

export interface AgentActivity {
  stepIndex: number;
  stepType: 'tool' | 'thinking' | 'agent_response' | string;
  state: 'ACTIVE' | 'DONE' | string;
  toolName?: string;
  toolParameters?: Record<string, unknown>;
  toolOutput?: string;
  durationSeconds?: number;
  thinkingTokens?: number;
}

export interface StreamEvent {
  type: 'delta' | 'done' | 'rotated' | 'error' | 'activity';
  text?: string;
  usage?: MessageUsage;
  durationSeconds?: number;
  error?: string;
  verificationUrl?: string;
  effectiveAccountId?: string;
  effectiveAccountEmail?: string;
  rotationInfo?: {
    fromEmail: string;
    toEmail: string;
    reason: string;
  };
  activity?: AgentActivity;
}

export interface StreamOptions {
  projectPath?: string;
  dangerouslySkipPermissions?: boolean;
  agentMode?: 'default' | 'accept-edits' | 'plan';
  sandboxMode?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
  skipConversationArg?: boolean;
}

/**
 * Asegura que los archivos de la trayectoria existan en la carpeta de antigravity-cli
 * sincronizándolos desde la carpeta de Antigravity Desktop (IDE) si fuera necesario.
 */
export function ensureTrajectoryInCli(conversationId: string): boolean {
  if (!conversationId) return false;
  const home = os.homedir();
  const cliConvoPath = path.join(home, '.gemini', 'antigravity-cli', 'conversations', `${conversationId}.db`);
  if (fs.existsSync(cliConvoPath)) {
    return true;
  }

  const ideConvoPath = path.join(home, '.gemini', 'antigravity', 'conversations', `${conversationId}.db`);
  if (fs.existsSync(ideConvoPath)) {
    try {
      const cliDir = path.join(home, '.gemini', 'antigravity-cli', 'conversations');
      if (!fs.existsSync(cliDir)) {
        fs.mkdirSync(cliDir, { recursive: true });
      }
      fs.copyFileSync(ideConvoPath, cliConvoPath);

      if (fs.existsSync(`${ideConvoPath}-shm`)) {
        fs.copyFileSync(`${ideConvoPath}-shm`, `${cliConvoPath}-shm`);
      }
      if (fs.existsSync(`${ideConvoPath}-wal`)) {
        fs.copyFileSync(`${ideConvoPath}-wal`, `${cliConvoPath}-wal`);
      }

      // Sincronizar directorio de brain si existe
      const ideBrain = path.join(home, '.gemini', 'antigravity', 'brain', conversationId);
      const cliBrain = path.join(home, '.gemini', 'antigravity-cli', 'brain', conversationId);
      if (fs.existsSync(ideBrain) && !fs.existsSync(cliBrain)) {
        fs.cpSync(ideBrain, cliBrain, { recursive: true });
      }

      // Sincronizar anotaciones si existen
      const ideAnnot = path.join(home, '.gemini', 'antigravity', 'annotations', `${conversationId}.pbtxt`);
      const cliAnnot = path.join(home, '.gemini', 'antigravity-cli', 'annotations', `${conversationId}.pbtxt`);
      if (fs.existsSync(ideAnnot) && !fs.existsSync(cliAnnot)) {
        fs.copyFileSync(ideAnnot, cliAnnot);
      }
      return true;
    } catch (err) {
      console.error(`Error sincronizando trayectoria ${conversationId} hacia antigravity-cli:`, err);
    }
  }
  return false;
}

export async function* streamPromptWithAgy(
  prompt: string,
  modelId: string,
  conversationId: string,
  targetAccountId?: string,
  options?: StreamOptions
): AsyncGenerator<StreamEvent> {
  const settings = getGlobalSettings();
  const model = findModel(modelId);
  const modelGroup = model.group;

  // 1. Resolver cuenta activa
  let account = targetAccountId ? getAccountById(targetAccountId) : getActiveAccount();
  if (!account) {
    yield {
      type: 'error',
      error: 'No hay ninguna cuenta de Google Antigravity configurada. Inicia sesión en Ajustes.',
    };
    return;
  }

  // Sincronizar token de la cuenta seleccionada en el sistema
  await syncStoredTokenToSystem(account.storedToken);

  // 2. Pre-chequeo de cuota si la rotación automática está activa
  if (settings.autoRotateOn5h || settings.autoRotateOnWeekly) {
    const quota = await fetchCurrentQuota(account.id);
    if (quota) {
      const evaluation = evaluateQuotaExhaustion(
        quota,
        modelGroup,
        settings.rotationThresholdFraction,
        settings.autoRotateOn5h,
        settings.autoRotateOnWeekly
      );

      if (evaluation.shouldRotate && account.inRotationPool) {
        const rotResult = await executeAutoRotation(
          account.id,
          evaluation.reason || 'Cuota límite superada antes de iniciar turno',
          modelId,
          modelGroup
        );

        if (rotResult.success && rotResult.newAccount) {
          yield {
            type: 'rotated',
            rotationInfo: {
              fromEmail: account.email,
              toEmail: rotResult.newAccount.email,
              reason: evaluation.reason || 'Cuota límite alcanzada',
            },
          };
          const newTarget = getAccountById(rotResult.newAccount.id);
          if (newTarget) {
            account = newTarget;
            await syncStoredTokenToSystem(newTarget.storedToken);
          }
        }
      }
    }
  }

  // 3. Resolver directorio de trabajo (Workspace) y banderas de agy
  let workingDir = process.cwd();

  if (options?.projectPath) {
    const valid = validateSafeWorkspacePath(options.projectPath);
    if (valid.valid && valid.resolvedPath) {
      workingDir = valid.resolvedPath;
    }
  } else if (settings.defaultProjectPath) {
    const valid = validateSafeWorkspacePath(settings.defaultProjectPath);
    if (valid.valid && valid.resolvedPath) {
      workingDir = valid.resolvedPath;
    }
  }

  // Directivas de sistema: contexto de workspace y auto-autorización para no bloquearse pidiendo permisos
  const systemDirectives = [
    settings.systemPrompt?.trim() || 'Eres muac, un asistente técnico de alta precisión con inteligencia de Antigravity Pro.',
    `[Workspace activo]: ${workingDir}`,
    'Tienes autorización explícita para aplicar todos los cambios en el código y ejecutar herramientas necesarias en este workspace. Aplica los cambios directamente con write_to_file, replace_file_content o run_command sin pedir confirmaciones interactivas ni invocar herramientas como ask_permission.',
  ].filter(Boolean).join('\n\n');

  let effectivePrompt = prompt;
  if (modelGroup === 'gemini') {
    effectivePrompt = `[System Instructions / Instrucciones de Sistema]:\n${systemDirectives}\n\n${prompt}`;
  }

  const trajectoryExists = ensureTrajectoryInCli(conversationId);

  const args = [
    '--print',
    effectivePrompt,
    '--model',
    model.id,
  ];

  if (!options?.skipConversationArg && trajectoryExists) {
    args.push('--conversation', conversationId);
  }

  args.push('--output-format', 'stream-json');

  // Añadir esfuerzo de razonamiento si el modelo lo soporta
  if (model.effortSupported) {
    let effort = options?.reasoningEffort || settings.reasoningEffort || 'high';
    if (model.supportedEfforts && model.supportedEfforts.length > 0 && !model.supportedEfforts.includes(effort)) {
      effort = model.supportedEfforts[0];
    }
    args.push('--effort', effort);
  }

  // Añadir directorio de trabajo al workspace
  args.push('--add-dir', normalizeWorkspacePath(workingDir));

  // Auto-aprobar permisos de herramientas
  const skipPerms = options?.dangerouslySkipPermissions ?? settings.dangerouslySkipPermissions ?? true;
  if (skipPerms) {
    args.push('--dangerously-skip-permissions');
  }

  // Modo de ejecución: por defecto 'accept-edits' para que agy aplique cambios de código sin suspenderse
  const mode = options?.agentMode || settings.agentMode || 'accept-edits';
  const effectiveMode = mode === 'default' ? 'accept-edits' : mode;
  args.push('--mode', effectiveMode);

  const sandbox = options?.sandboxMode ?? settings.sandboxMode ?? false;
  if (sandbox) {
    args.push('--sandbox');
  }

  if (options?.signal?.aborted) {
    return;
  }

  let hasAttemptedFailover = false;
  let accumulatedText = '';
  let finalUsage: MessageUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  let duration = 0;

  // Spawneo multiplataforma del proceso agy en el directorio de trabajo
  const agyCmd = getAgyCommand();
  const child = spawn(agyCmd.command, args, {
    cwd: workingDir,
    env: process.env,
    shell: agyCmd.shell,
  });

  // Auto-responder afirmativamente a cualquier prompt interactivo de confirmación o permisos en stdin
  const autoConfirmPrompt = (data: Buffer | string) => {
    const str = typeof data === 'string' ? data : data.toString();
    if (
      /proceed|permission|confirm|allow|\(y\/n\)|\[y\/n\]|\[Y\/n\]|\[y\/N\]|\? \[y/i.test(str)
    ) {
      try {
        if (child.stdin && !child.stdin.destroyed && child.stdin.writable) {
          child.stdin.write('y\n');
        }
      } catch {}
    }
  };

  child.stdout.on('data', autoConfirmPrompt);
  child.stderr.on('data', autoConfirmPrompt);

  const onAbort = () => {
    try {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    } catch {
      // Ignorar error al matar proceso terminado
    }
  };

  if (options?.signal) {
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  let stderrText = '';
  child.stderr.on('data', (chunk) => {
    stderrText += chunk.toString();
  });

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false,
  });

  let quotaExhaustedDuringRun = false;
  let eligibilityCheckFailed = false;
  let lastAgyError = '';
  let extractedVerificationUrl = '';

  try {
    for await (const line of rl) {
      if (options?.signal?.aborted) {
        break;
      }
      if (!line.trim()) continue;

      // Buscar URLs de verificación de Google en el stream
      const urlMatch = line.match(/https:\/\/(?:accounts\.google\.com|developers\.google\.com)[^\s"'<>]+/);
      if (urlMatch && !extractedVerificationUrl) {
        extractedVerificationUrl = urlMatch[0];
      }

      try {
        const parsed = JSON.parse(line);

        if (parsed.event === 'step_update' && parsed.step_update) {
          const step = parsed.step_update;

          // Si una herramienta solicita permiso interactivo, auto-responder afirmativamente
          if (
            step.step_type === 'tool' &&
            (step.tool_name === 'ask_permission' ||
              step.tool_name === 'ask_custom_permission' ||
              step.tool_name === 'ask_question')
          ) {
            try {
              if (child.stdin && !child.stdin.destroyed && child.stdin.writable) {
                child.stdin.write('y\n');
              }
            } catch {}
          }

          // Emitir actividad de herramienta (ej. list_dir, run_command, view_file, etc.)
          if (step.step_type === 'tool') {
            yield {
              type: 'activity',
              activity: {
                stepIndex: step.step_index,
                stepType: 'tool',
                state: step.state || 'ACTIVE',
                toolName: step.tool_name || step.tool_info?.name || 'tool',
                toolParameters: step.tool_info?.parameters,
                toolOutput:
                  typeof step.tool_info?.output === 'string'
                    ? step.tool_info.output.slice(0, 300)
                    : undefined,
                durationSeconds: step.duration_seconds,
              },
            };
          }

          // Emitir actividad de razonamiento (pensamiento)
          if (step.step_type === 'agent_response' && !step.text_delta) {
            yield {
              type: 'activity',
              activity: {
                stepIndex: step.step_index,
                stepType: 'thinking',
                state: step.state || 'ACTIVE',
                durationSeconds: step.duration_seconds,
              },
            };
          }

          // Solo acumular y emitir deltas destinados como mensaje final para el usuario
          if (step.step_type === 'agent_response' && step.text_delta) {
            // Filtrar posibles etiquetas <thought>...</thought> del modelo
            const cleanDelta = step.text_delta.replace(/<\/?thought>/gi, '');
            if (cleanDelta) {
              accumulatedText += cleanDelta;
              yield { type: 'delta', text: cleanDelta };
            }
          }

          if (step.usage) {
            finalUsage = {
              inputTokens: step.usage.input_tokens || 0,
              outputTokens: step.usage.output_tokens || 0,
              thinkingTokens: step.usage.thinking_tokens,
              totalTokens: step.usage.total_tokens || 0,
            };
          }
        } else if (parsed.event === 'result' && parsed.result) {
          const res = parsed.result;
          if (res.duration_seconds) duration = res.duration_seconds;
          if (res.response && typeof res.response === 'string') {
            accumulatedText = res.response.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
          }
          if (res.usage) {
            finalUsage = {
              inputTokens: res.usage.input_tokens || 0,
              outputTokens: res.usage.output_tokens || 0,
              thinkingTokens: res.usage.thinking_tokens,
              totalTokens: res.usage.total_tokens || 0,
            };
          }
          if (res.status === 'ERROR') {
            lastAgyError = res.error || 'Error desconocido reportado por agy';
            if (
              lastAgyError.includes('exhausted your quota') ||
              lastAgyError.includes('429')
            ) {
              quotaExhaustedDuringRun = true;
            } else if (lastAgyError.includes('Eligibility check failed') || lastAgyError.includes('not eligible')) {
              eligibilityCheckFailed = true;
            }
          }
        }
      } catch {
        if (line.includes('exhausted your quota') || line.includes('429')) {
          quotaExhaustedDuringRun = true;
        } else if (line.includes('Eligibility check failed') || line.includes('not eligible')) {
          eligibilityCheckFailed = true;
          lastAgyError = line;
        }
      }
    }
  } finally {
    if (options?.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }

  // Si no se capturó error estructurado pero stderr contiene información de error
  if (!lastAgyError && stderrText.trim()) {
    if (stderrText.includes('Eligibility check failed') || stderrText.includes('not eligible')) {
      eligibilityCheckFailed = true;
    }
    const urlMatch = stderrText.match(/https:\/\/(?:accounts\.google\.com|developers\.google\.com)[^\s"'<>]+/);
    if (urlMatch && !extractedVerificationUrl) {
      extractedVerificationUrl = urlMatch[0];
    }
    lastAgyError = stderrText.trim();
  }

  // 4. Detección de "trajectory not found": auto-heal automático
  const isTrajectoryNotFound =
    (lastAgyError && lastAgyError.includes('trajectory not found')) ||
    stderrText.includes('trajectory not found');

  if (isTrajectoryNotFound && !options?.skipConversationArg) {
    console.warn(`[muac] Trayectoria ${conversationId} no encontrada por agy. Recuperando de forma automática...`);
    for await (const subEvent of streamPromptWithAgy(prompt, modelId, conversationId, targetAccountId, {
      ...options,
      skipConversationArg: true,
    })) {
      yield subEvent;
    }
    return;
  }

  // Si el usuario canceló la respuesta activamente
  if (options?.signal?.aborted) {
    yield {
      type: 'done',
      text: accumulatedText,
      usage: finalUsage,
      durationSeconds: duration,
      effectiveAccountId: account.id,
      effectiveAccountEmail: account.email,
    };
    return;
  }

  // 5. Si la cuota se agotó o la cuenta no es elegible y está en el pool, ejecutar rotación automática
  const shouldFailover = (quotaExhaustedDuringRun || eligibilityCheckFailed) && !hasAttemptedFailover && account.inRotationPool;
  if (shouldFailover) {
    hasAttemptedFailover = true;
    const failoverReason = quotaExhaustedDuringRun
      ? 'Cuota de 5h o semanal agotada durante el turno'
      : `Cuenta no elegible o pendiente de verificación (${account.email})`;

    const rotResult = await executeAutoRotation(
      account.id,
      failoverReason,
      modelId,
      modelGroup
    );

    if (rotResult.success && rotResult.newAccount && rotResult.newAccount.id !== account.id) {
      yield {
        type: 'rotated',
        rotationInfo: {
          fromEmail: account.email,
          toEmail: rotResult.newAccount.email,
          reason: quotaExhaustedDuringRun
            ? 'Agotamiento de tokens en ejecución. Conmutando cuenta...'
            : 'Cuenta requiere verificación de Google. Conmutando a cuenta disponible...',
        },
      };

      const newTarget = getAccountById(rotResult.newAccount.id);
      if (newTarget) {
        await syncStoredTokenToSystem(newTarget.storedToken);
        // Reintentar recursivamente con la nueva cuenta
        for await (const subEvent of streamPromptWithAgy(prompt, modelId, conversationId, newTarget.id, options)) {
          yield subEvent;
        }
        return;
      }
    }
  }

  // 6. Si hubo un error no recuperable, emitirlo
  if (lastAgyError && accumulatedText.trim().length === 0) {
    yield {
      type: 'error',
      error: lastAgyError,
      verificationUrl: extractedVerificationUrl || undefined,
      effectiveAccountId: account.id,
      effectiveAccountEmail: account.email,
    };
    return;
  }

  // 7. Finalización ordinaria
  yield {
    type: 'done',
    text: accumulatedText,
    usage: finalUsage,
    durationSeconds: duration,
    effectiveAccountId: account.id,
    effectiveAccountEmail: account.email,
  };
}
