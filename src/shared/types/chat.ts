export interface MessageUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'file';
  mimeType: string;
  size: number;
  url: string;
  path?: string;
  lineCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  durationSeconds?: number;
  usage?: MessageUsage;
  accountId?: string;
  accountEmail?: string;
  modelId?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  modelId: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  totalTokens: number;
  messagesCount?: number;
  projectPath?: string;
  isPinned?: boolean;
}

export interface ContextWindowUsage {
  usedTokens: number;
  maxTokens: number;
  percentage: number; // 0 a 100
  colorState: 'safe' | 'warning' | 'danger'; // safe < 60%, warning 60-85%, danger > 85%
}
