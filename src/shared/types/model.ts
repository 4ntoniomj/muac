export interface AntigravityModel {
  id: string;
  name: string;
  group: 'gemini' | '3p';
  contextLimit: number;
  effortSupported: boolean;
  supportedEfforts: Array<'low' | 'medium' | 'high'>;
  description: string;
}

export const ANTIGRAVITY_MODELS: AntigravityModel[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    group: 'gemini',
    contextLimit: 1048576,
    effortSupported: true,
    supportedEfforts: ['low', 'medium', 'high'],
    description: 'Máxima velocidad y razonamiento configurable (Bajo, Medio, Alto).'
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    group: 'gemini',
    contextLimit: 1048576,
    effortSupported: true,
    supportedEfforts: ['low', 'medium', 'high'],
    description: 'Generación balanceada para desarrollo y asistencia técnica.'
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    group: 'gemini',
    contextLimit: 2097152,
    effortSupported: true,
    supportedEfforts: ['low', 'high'],
    description: 'Ventana de contexto ultra-amplia de 2M tokens y razonamiento profundo.'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    group: '3p',
    contextLimit: 200000,
    effortSupported: false,
    supportedEfforts: [],
    description: 'Cadena de razonamiento estructurada Claude (esfuerzo fijado por modelo).'
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    group: '3p',
    contextLimit: 200000,
    effortSupported: false,
    supportedEfforts: [],
    description: 'Máxima inteligencia y análisis riguroso para problemas complejos.'
  },
  {
    id: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B',
    group: '3p',
    contextLimit: 128000,
    effortSupported: false,
    supportedEfforts: [],
    description: 'Modelo abierto balanceado de 120B parámetros.'
  }
];

export function findModel(modelId: string): AntigravityModel {
  // Búsqueda directa
  const exact = ANTIGRAVITY_MODELS.find((m) => m.id === modelId);
  if (exact) return exact;

  // Búsqueda normalizando sufijos históricos como -high, -medium, -low
  const normalizedId = modelId.replace(/-(high|medium|low)$/, '');
  const base = ANTIGRAVITY_MODELS.find((m) => m.id === normalizedId);
  if (base) return base;

  return ANTIGRAVITY_MODELS[0];
}
