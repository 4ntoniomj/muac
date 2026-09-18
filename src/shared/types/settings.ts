export interface AgentToolPermissions {
  terminalCommands: boolean; // Ejecutar comandos en terminal/shell
  fileEdits: boolean; // Modificar y escribir archivos
  fileReads: boolean; // Leer e inspeccionar archivos del workspace
  webAccess: boolean; // Navegación y búsqueda web
  subagents: boolean; // Delegar e invocar subagentes
}

export interface GlobalSettings {
  defaultModelId: string;
  systemPrompt: string;
  temperature: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  autoRotateOn5h: boolean;
  autoRotateOnWeekly: boolean;
  rotationThresholdFraction: number; // Por defecto 0.05 (5%)
  activeAccountId: string;
  theme: 'dark';
  dangerouslySkipPermissions: boolean; // Auto-aprobar permisos de herramientas (--dangerously-skip-permissions)
  agentMode: 'default' | 'accept-edits' | 'plan'; // Modo de ejecución (--mode)
  sandboxMode: boolean; // Ejecutar en sandbox (--sandbox)
  defaultProjectPath: string; // Ruta de proyecto local por defecto
  allowedPermissions: AgentToolPermissions; // Permisos individuales seleccionables del agente
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  defaultModelId: 'gemini-3.8-flash-high',
  systemPrompt: 'Eres muac, un asistente técnico de alta precisión con inteligencia de Antigravity Pro.',
  temperature: 0.7,
  reasoningEffort: 'high',
  autoRotateOn5h: true,
  autoRotateOnWeekly: true,
  rotationThresholdFraction: 0.05,
  activeAccountId: '',
  theme: 'dark',
  dangerouslySkipPermissions: true,
  agentMode: 'default',
  sandboxMode: false,
  defaultProjectPath: '',
  allowedPermissions: {
    terminalCommands: true,
    fileEdits: true,
    fileReads: true,
    webAccess: true,
    subagents: true,
  },
};
