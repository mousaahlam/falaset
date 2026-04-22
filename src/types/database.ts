export type ItemKind = 'content' | 'app';

export interface ItemRow {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  url: string;
  locale: string | null;
  country: string | null;
  tags: string[] | null;
  rank: number;
  created_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  locale: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string; // bytea surfaces as base64 via PostgREST
  sign_count: number;
  device_label: string | null;
  transports: string[] | null;
  aaguid: string | null;
  last_used_at: string | null;
  created_at: string;
}

export type IntegrationStatus = 'active' | 'revoked';

export interface IntegrationRow {
  id: string;
  user_id: string;
  provider: string;
  account_ref: string | null;
  status: IntegrationStatus;
  connected_at: string;
  revoked_at: string | null;
}

export interface AuthorizationGrantRow {
  id: string;
  user_id: string;
  integration_id: string | null;
  action_kind: string;
  scope: Record<string, unknown>;
  per_action_limit: number | null;
  daily_limit: number | null;
  currency: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type ActionStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface ActionRequestRow {
  id: string;
  user_id: string;
  action_kind: string;
  input: Record<string, unknown>;
  preview: ActionPreview;
  status: ActionStatus;
  confirmation_method: 'biometric' | 'passkey' | null;
  idempotency_key: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  confirmed_at: string | null;
  executed_at: string | null;
}

// What the confirmation sheet renders. Kept small and generic — any tool can
// emit this shape, and the UI can show it without tool-specific knowledge.
export interface ActionPreview {
  title: string;
  summary: string;
  details?: { label: string; value: string }[];
  risk?: 'low' | 'medium' | 'high';
  reversible?: boolean;
}

export interface ActionAuditRow {
  id: number;
  user_id: string;
  request_id: string | null;
  event: string;
  detail: Record<string, unknown>;
  occurred_at: string;
}

export interface Database {
  public: {
    Tables: {
      items: {
        Row: ItemRow;
        Insert: Omit<ItemRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ItemRow>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
      };
      passkeys: {
        Row: PasskeyRow;
        Insert: Omit<PasskeyRow, 'id' | 'created_at' | 'sign_count'> & {
          id?: string;
          created_at?: string;
          sign_count?: number;
        };
        Update: Partial<PasskeyRow>;
      };
      integrations: {
        Row: IntegrationRow;
        Insert: Omit<IntegrationRow, 'id' | 'connected_at'> & {
          id?: string;
          connected_at?: string;
        };
        Update: Partial<IntegrationRow>;
      };
      authorization_grants: {
        Row: AuthorizationGrantRow;
        Insert: Omit<AuthorizationGrantRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AuthorizationGrantRow>;
      };
      action_requests: {
        Row: ActionRequestRow;
        Insert: Omit<ActionRequestRow, 'id' | 'created_at' | 'status'> & {
          id?: string;
          created_at?: string;
          status?: ActionStatus;
        };
        Update: Partial<Pick<ActionRequestRow, 'status'>>;
      };
      action_audit_log: {
        Row: ActionAuditRow;
        Insert: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      action_status: ActionStatus;
    };
  };
}
