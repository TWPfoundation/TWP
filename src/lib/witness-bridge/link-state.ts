import type { SupabaseClient } from '@supabase/supabase-js';

export type WitnessRuntimeAccessStatus =
  | 'pending'
  | 'accepted'
  | 'active'
  | 'revoked';

export type WitnessRuntimeBridgeStatus =
  | 'pending'
  | 'ready'
  | 'active'
  | 'error';

export type WitnessRuntimeConsentStatus =
  | 'unknown'
  | 'missing_required'
  | 'ready';

export interface WitnessRuntimeLinkPatch {
  witnessId: string;
  accessStatus?: WitnessRuntimeAccessStatus;
  bridgeStatus?: WitnessRuntimeBridgeStatus;
  runtimeConsentStatus?: WitnessRuntimeConsentStatus;
  lastBridgeError?: string | null;
}

export async function upsertWitnessRuntimeLink(
  supabaseAdmin: SupabaseClient,
  patch: WitnessRuntimeLinkPatch
) {
  const now = new Date().toISOString();
  const payload = {
    witness_id: patch.witnessId,
    access_status: patch.accessStatus ?? 'accepted',
    bridge_status: patch.bridgeStatus ?? 'pending',
    runtime_consent_status: patch.runtimeConsentStatus ?? 'unknown',
    last_bridge_error:
      patch.lastBridgeError === undefined ? null : patch.lastBridgeError,
    last_bridge_synced_at: now,
    updated_at: now,
  };

  return supabaseAdmin.from('witness_runtime_links').upsert(payload, {
    onConflict: 'witness_id',
  });
}

export async function logWitnessBridgeAudit(
  supabaseAdmin: SupabaseClient,
  input: {
    action: string;
    actorId: string;
    witnessId: string;
    metadata?: Record<string, unknown>;
  }
) {
  return supabaseAdmin.from('audit_log').insert({
    action: input.action,
    actor_id: input.actorId,
    target_type: 'witness_runtime_link',
    target_id: input.witnessId,
    metadata: input.metadata ?? {},
  });
}
