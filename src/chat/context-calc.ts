import { findModel } from '@/shared/types/model';
import type { Message, ContextWindowUsage } from '@/shared/types/chat';

// Sobrecarga base de herramientas e instrucciones del sistema en agy CLI (~13,260 tokens)
const AGY_BASE_SYSTEM_TOKENS = 13260;

export function calculateContextUsage(
  messages: Message[],
  currentDraft: string,
  modelId: string
): ContextWindowUsage {
  const model = findModel(modelId);
  const maxTokens = model.contextLimit;

  // En agy, cada respuesta del asistente reporta en totalTokens (input_tokens + output_tokens)
  // el tamaño total del contexto acumulado de la conversación.
  // Buscamos el último mensaje del asistente que tenga métricas reales de uso.
  let baseTokens = 0;
  let lastAssistantIndex = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.usage && m.usage.totalTokens > 0) {
      baseTokens = m.usage.totalTokens;
      lastAssistantIndex = i;
      break;
    }
  }

  // Si no hay respuestas previas del asistente, usamos la sobrecarga base del sistema
  // más los tokens estimados de los mensajes iniciales del usuario
  let conversationTokens = baseTokens;
  if (lastAssistantIndex === -1) {
    if (messages.length > 0) {
      conversationTokens = AGY_BASE_SYSTEM_TOKENS;
      for (const m of messages) {
        conversationTokens += Math.ceil((m.content.length || 1) / 4);
      }
    } else {
      // Conversación completamente vacía
      conversationTokens = 0;
    }
  } else {
    // Si hay mensajes del usuario posteriores al último turno del asistente, sumar su estimación
    for (let i = lastAssistantIndex + 1; i < messages.length; i++) {
      const m = messages[i];
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
