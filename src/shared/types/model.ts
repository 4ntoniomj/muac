export interface AntigravityModel {
  id: string;
  name: string;
  group: 'gemini' | '3p';
  contextLimit: number;
  effortSupported: boolean;
  description: string;
}

export const ANTIGRAVITY_MODELS: AntigravityModel[] = [
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    group: 'gemini',
    contextLimit: 1048576,
    effortSupported: true,
    description: 'Máxima velocidad y razonamiento avanzado para tareas intensivas.'
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    group: 'gemini',
    contextLimit: 1048576,
    effortSupported: true,
    description: 'Equilibrio óptimo de latencia y razonamiento.'
  },
  {
    id: 'gemini-3.8-flash-low',
    name: 'Gemini 3.8 Flash (Low)',
    group: 'gemini',
    contextLimit: 1048576,
    effortSupported: true,
    description: 'Mínima latencia para consultas rápidas.'
  },
  {
    id: 'gemini-3.1-pro-high',
    name: 'Gemini 3.1 Pro (High)',
    group: 'gemini',
    contextLimit: 2097152,
    effortSupported: true,
    description: 'Capacidad de contexto de 2M tokens y razonamiento profundo.'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    group: '3p',
    contextLimit: 200000,
    effortSupported: true,
    description: 'Modelo Claude con cadena de pensamiento estructurada.'
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    group: '3p',
    contextLimit: 200000,
    effortSupported: true,
    description: 'Máxima inteligencia y análisis riguroso.'
  },
  {
    id: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B (Medium)',
    group: '3p',
    contextLimit: 128000,
    effortSupported: true,
    description: 'Modelo abierto balanceado de 120B parámetros.'
  }
];
