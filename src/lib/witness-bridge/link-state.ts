import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  WitnessRuntimeAccessStatus,
  WitnessRuntimeBridgeStatus,
  WitnessRuntimeConsentStatus,
} from '@/lib/witness-bridge/lifecycle';

export interface WitnessRuntimeLinkPatch {
  witnessId: string;
  accessStatus?: WitnessRuntimeAccessStatus;
  bridgeStatus?: WitnessRuntimeBridgeStatus;
  runtimeConsentStatus?: WitnessRuntimeConsentStatus;
  lastBridgeError?: string | null;
}

export interface WitnessRuntimeLinkRecord {
  accessStatus: WitnessRuntimeAccessStatus;
  bridgeStatus: WitnessRuntimeBridgeStatus;
  runtimeConsentStatus: WitnessRuntimeConsentStatus;
  lastBridgeError: string | null;
  lastBridgeSyncedAt?: string | null;
}

export async function getWitnessRuntimeLink(
  supabaseAdmin: SupabaseClient,
  witnessId: string
): Promise<WitnessRuntimeLinkRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('witness_runtime_links')
    .select(
      'access_status, bridge_status, runtime_consent_status, last_bridge_error, last_bridge_synced_at'
    )
    .eq('witness_id', witnessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    accessStatus: data.access_status as WitnessRuntimeAccessStatus,
    bridgeStatus: data.bridge_status as WitnessRuntimeBridgeStatus,
    runtimeConsentStatus:
      data.runtime_consent_status as WitnessRuntimeConsentStatus,
    lastBridgeError:
      typeof data.last_bridge_error === 'string' ? data.last_bridge_error : null,
    lastBridgeSyncedAt:
      typeof data.last_bridge_synced_at === 'string'
        ? data.last_bridge_synced_at
        : null,
  };
}

export async function upsertWitnessRuntimeLink(
  supabaseAdmin: SupabaseClient,
  patch: WitnessRuntimeLinkPatch
) {
  const now = new Date().toISOString();
  const existing = await getWitnessRuntimeLink(supabaseAdmin, patch.witnessId);

  const payload = {
    witness_id: patch.witnessId,
    access_status: patch.accessStatus ?? existing?.accessStatus ?? 'accepted',
    bridge_status: patch.bridgeStatus ?? existing?.bridgeStatus ?? 'pending',
    runtime_consent_status:
      patch.runtimeConsentStatus ??
      existing?.runtimeConsentStatus ??
      'unknown',
    last_bridge_error:
      patch.lastBridgeError !== undefined
        ? patch.lastBridgeError
        : existing?.lastBridgeError ?? null,
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

export async function logWitnessLifecycleTransition(
  supabaseAdmin: SupabaseClient,
  input: {
    actorId: string;
    witnessId: string;
    previousAccessStatus?: WitnessRuntimeAccessStatus | null;
    nextAccessStatus: WitnessRuntimeAccessStatus;
    metadata?: Record<string, unknown>;
  }
) {
  if (input.previousAccessStatus === input.nextAccessStatus) {
    return null;
  }

  return logWitnessBridgeAudit(supabaseAdmin, {
    action: `witness.lifecycle.${input.nextAccessStatus}`,
    actorId: input.actorId,
    witnessId: input.witnessId,
    metadata: {
      previousAccessStatus: input.previousAccessStatus ?? null,
      nextAccessStatus: input.nextAccessStatus,
      ...(input.metadata ?? {}),
    },
  });
}
