import * as LocalAuthentication from 'expo-local-authentication';

import { supabase } from '@/lib/supabase';
import type { ActionPreview, ActionRequestRow } from '@/types/database';

export interface RequestActionInput {
  actionKind: string;
  input: Record<string, unknown>;
  preview: ActionPreview;
  idempotencyKey?: string;
}

/**
 * Submit an action for the agent to execute on behalf of the user.
 *
 * Flow:
 *   1. Client builds a human-readable preview.
 *   2. requestAction() inserts a row in 'pending_confirmation'.
 *   3. UI shows the preview; user must explicitly confirm.
 *   4. confirmAction() requires a local biometric check before flipping to
 *      'confirmed'. The server-side executor picks it up from there.
 *
 * Clients CANNOT transition rows into 'executing' / 'succeeded' / 'failed' —
 * RLS blocks those transitions. Audit rows are written automatically.
 */
export async function requestAction(req: RequestActionInput): Promise<ActionRequestRow> {
  const { data, error } = await supabase
    .from('action_requests')
    .insert({
      action_kind: req.actionKind,
      input: req.input,
      preview: req.preview,
      idempotency_key: req.idempotencyKey ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ActionRequestRow;
}

export async function confirmAction(requestId: string): Promise<ActionRequestRow> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) {
    throw new Error('Biometric/passcode confirmation is required to authorize this action.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm action',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  if (!result.success) throw new Error('Confirmation was cancelled.');

  const { data, error } = await supabase
    .from('action_requests')
    .update({ status: 'confirmed' })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw error;
  return data as ActionRequestRow;
}

export async function cancelAction(requestId: string): Promise<ActionRequestRow> {
  const { data, error } = await supabase
    .from('action_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw error;
  return data as ActionRequestRow;
}

export async function getAction(requestId: string): Promise<ActionRequestRow | null> {
  const { data, error } = await supabase
    .from('action_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as ActionRequestRow) ?? null;
}
