export interface QuotaBucket {
  id: string;
  name: string;
  window: '5h' | 'weekly';
  remainingFraction: number; // 0.0 a 1.0
  resetTime: string; // ISO 8601
  description?: string;
}

export interface QuotaGroup {
  name: string;
  description?: string;
  buckets: QuotaBucket[];
}

export interface AccountQuotaSummary {
  accountId: string;
  fetchedAt: string;
  groups: QuotaGroup[];
  gemini5hRemaining: number;
  geminiWeeklyRemaining: number;
  gemini5hReset: string;
  geminiWeeklyReset: string;
  thirdParty5hRemaining: number;
  thirdPartyWeeklyRemaining: number;
  thirdParty5hReset: string;
  thirdPartyWeeklyReset: string;
}

export interface RotationEvent {
  id: string;
  timestamp: string;
  fromAccountId: string;
  toAccountId: string;
  fromEmail: string;
  toEmail: string;
  reason: string;
  modelId: string;
}
