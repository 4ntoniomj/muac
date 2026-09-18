export interface GoogleTokenData {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expiry: string;
}

export interface StoredToken {
  token: GoogleTokenData;
  auth_method: string;
  id_token?: string;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  inRotationPool: boolean;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountWithQuota extends Account {
  quota?: import('./quota').AccountQuotaSummary;
}
