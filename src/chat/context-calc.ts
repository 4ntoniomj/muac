import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import type { Message, ContextWindowUsage } from '@/shared/types/chat';

export function calculateContextUsage(
  messages: Message[],
  currentDraft: string,
  modelId: string
): ContextWindowUsage {
  const model = ANTIGRAVITY_MODELS.find((m) => m.id === modelId) || ANTIGRAVITY_MODELS[0];
  const maxTokens = model.contextLimit;

  // Calcular tokens de mensajes previos
  let conversationTokens = 0;
  for (const m of messages) {
    if (m.usage?.totalTokens) {
      conversationTokens += m.usage.totalTokens;
    } else {
      // Estimación aproximada (1 token ~ 4 caracteres)
      conversationTokens += Math.ceil((m.content.length || 1) / 4);
    }
  }

  // Estimación del texto en redacción en el input
  const draftTokens = currentDraft.trim().length > 0 ? Math.ceil(currentDraft.length / 4) : 0;
  const usedTokens = conversationTokens + draftTokens;

  const percentage = Math.min(100, Math.max(0, Number(((usedTokens / maxTokens) * 100).toFixed(2))));

  let colorState: 'safe' | 'warning' | 'danger' = 'safe';
  if (percentage >= 85) {
    colorState = 'danger';
  } else if (percentage >= 60) {
    colorState = 'warning';
  }

  return {
    usedTokens,
    maxTokens,
    percentage,
    colorState,
  };
}
