import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { getActiveAccount, getAccountById } from '@/cuentas/account-store';
import { syncStoredTokenToSystem } from '@/cuentas/keyring-sync';
import { evaluateQuotaExhaustion, executeAutoRotation } from '@/rotacion/rotation-engine';
import { fetchCurrentQuota } from '@/rotacion/quota-monitor';
import { getGlobalSettings } from '@/configuracion/settings-store';
import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import type { MessageUsage } from '@/shared/types/chat';

export interface StreamEvent {
  type: 'delta' | 'done' | 'rotated' | 'error';
  text?: string;
  usage?: MessageUsage;
  durationSeconds?: number;
  error?: string;
  rotationInfo?: {
    fromEmail: string;
    toEmail: string;
    reason: string;
  };
}

export interface StreamOptions {
  projectPath?: string;
  dangerouslySkipPermissions?: boolean;
  agentMode?: 'default' | 'accept-edits' | 'plan';
  sandboxMode?: boolean;
}

export async function* streamPromptWithAgy(
  prompt: string,
  modelId: string,
  conversationId: string,
  targetAccountId?: string,
  options?: StreamOptions
): AsyncGenerator<StreamEvent> {
  const settings = getGlobalSettings();
  const model = ANTIGRAVITY_MODELS.find((m) => m.id === modelId) || ANTIGRAVITY_MODELS[0];
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
  const args = [
    '--print',
    prompt,
    '--model',
    modelId,
    '--conversation',
    conversationId,
    '--output-format',
    'stream-json',
  ];

  if (options?.projectPath && fs.existsSync(options.projectPath)) {
    workingDir = path.resolve(options.projectPath);
    args.push('--add-dir', workingDir);
  } else if (settings.defaultProjectPath && fs.existsSync(settings.defaultProjectPath)) {
    workingDir = path.resolve(settings.defaultProjectPath);
    args.push('--add-dir', workingDir);
  }

  const skipPerms = options?.dangerouslySkipPermissions ?? settings.dangerouslySkipPermissions ?? true;
  if (skipPerms) {
    args.push('--dangerously-skip-permissions');
  }

  const mode = options?.agentMode || settings.agentMode;
  if (mode && mode !== 'default') {
    args.push('--mode', mode);
  }

  const sandbox = options?.sandboxMode ?? settings.sandboxMode ?? false;
  if (sandbox) {
    args.push('--sandbox');
  }

  let hasAttemptedFailover = false;
  let accumulatedText = '';
  let finalUsage: MessageUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  let duration = 0;

  // Spawneo del proceso agy en el directorio de trabajo especificado
  const child = spawn('agy', args, {
    cwd: workingDir,
    env: process.env,
  });

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false,
  });

  let quotaExhaustedDuringRun = false;
  let finalResultReceived = false;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);

      if (parsed.event === 'step_update' && parsed.step_update) {
        const step = parsed.step_update;
        if (step.text_delta) {
          accumulatedText += step.text_delta;
          yield { type: 'delta', text: step.text_delta };
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
        finalResultReceived = true;
        const res = parsed.result;
        if (res.duration_seconds) duration = res.duration_seconds;
        if (res.usage) {
          finalUsage = {
            inputTokens: res.usage.input_tokens || 0,
            outputTokens: res.usage.output_tokens || 0,
            thinkingTokens: res.usage.thinking_tokens,
            totalTokens: res.usage.total_tokens || 0,
          };
        }
        if (
          res.status === 'ERROR' &&
          res.error &&
          (res.error.includes('exhausted your quota') || res.error.includes('429'))
        ) {
          quotaExhaustedDuringRun = true;
        }
      }
    } catch {
      if (line.includes('exhausted your quota') || line.includes('429')) {
        quotaExhaustedDuringRun = true;
      }
    }
  }

  // 4. Si la cuota se agotó durante el streaming y está en el pool, ejecutar rotación y reintento
  if (quotaExhaustedDuringRun && !hasAttemptedFailover && account.inRotationPool) {
    hasAttemptedFailover = true;
    const rotResult = await executeAutoRotation(
      account.id,
      'Cuota de 5h o semanal agotada durante el turno',
      modelId,
      modelGroup
    );

    if (rotResult.success && rotResult.newAccount) {
      yield {
        type: 'rotated',
        rotationInfo: {
          fromEmail: account.email,
          toEmail: rotResult.newAccount.email,
          reason: 'Agotamiento de tokens en ejecución. Conmutando cuenta...',
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

  // 5. Finalización ordinaria
  yield {
    type: 'done',
    text: accumulatedText,
    usage: finalUsage,
    durationSeconds: duration,
  };
}
