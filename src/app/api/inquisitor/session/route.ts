import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  bootstrapWitnessRuntime,
  WitnessBridgeClient,
  WitnessBridgeConfigError,
  WitnessBridgeHttpError,
} from '@/lib/witness-bridge/client';
import {
  getWitnessRuntimeLink,
  logWitnessBridgeAudit,
  logWitnessLifecycleTransition,
  upsertWitnessRuntimeLink,
} from '@/lib/witness-bridge/link-state';
import {
  classifyWitnessBridgeFailure,
  deriveWitnessAccessStatus,
  deriveWitnessOperatorLifecycleStatus,
  isWitnessRuntimeAccessBlocked,
} from '@/lib/witness-bridge/lifecycle';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toBridgeErrorResponse(error: unknown) {
  if (error instanceof WitnessBridgeConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof WitnessBridgeHttpError) {
    const details =
      error.details && typeof error.details === 'object' ? error.details : {};
    return NextResponse.json(
      {
        error: error.message,
        retryable: error.retryable,
        ...(details as Record<string, unknown>),
      },
      { status: error.status }
    );
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  let witnessId: string | undefined;
  let currentLink: Awaited<ReturnType<typeof getWitnessRuntimeLink>> = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('witness_profiles')
      .select('id, status')
      .eq('supabase_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    witnessId = profile.id;
    currentLink = await getWitnessRuntimeLink(supabaseAdmin, profile.id);

    if (isWitnessRuntimeAccessBlocked(currentLink?.accessStatus)) {
      return NextResponse.json(
        { error: 'Witness runtime access has been revoked.' },
        { status: 403 }
      );
    }

    const { data: acceptedTestimony } = await supabaseAdmin
      .from('testimony_records')
      .select('id')
      .eq('witness_id', profile.id)
      .eq('status', 'annotating')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!acceptedTestimony) {
      return NextResponse.json({
        bridgeStatus: 'pending',
        consentStatus: 'unknown',
        missingScopes: [],
        session: null,
        latestTestimony: null,
        error:
          'The Instrument is only accessible after your testimony has been accepted through The Gate.',
      });
    }

    const bridge = new WitnessBridgeClient();
    const runtime = await bootstrapWitnessRuntime(bridge, profile.id);
    const nextAccessStatus = deriveWitnessAccessStatus({
      currentAccessStatus: currentLink?.accessStatus,
      hasSession: Boolean(runtime.session),
      latestTestimonyState: runtime.latestTestimony?.state,
    });

    await upsertWitnessRuntimeLink(supabaseAdmin, {
      witnessId: profile.id,
      accessStatus: nextAccessStatus,
      bridgeStatus: runtime.bridgeStatus,
      runtimeConsentStatus: runtime.consentStatus,
      lastBridgeError: null,
    });

    await logWitnessLifecycleTransition(supabaseAdmin, {
      actorId: profile.id,
      witnessId: profile.id,
      previousAccessStatus: currentLink?.accessStatus,
      nextAccessStatus,
      metadata: {
        via: 'witness.bridge.bootstrap',
        latestTestimonyState: runtime.latestTestimony?.state ?? null,
      },
    });

    await logWitnessBridgeAudit(supabaseAdmin, {
      action: 'witness.bridge.bootstrap',
      actorId: profile.id,
      witnessId: profile.id,
      metadata: {
        profileStatus: profile.status,
        bridgeStatus: runtime.bridgeStatus,
        consentStatus: runtime.consentStatus,
        lifecycleStatus: deriveWitnessOperatorLifecycleStatus({
          accessStatus: nextAccessStatus,
          bridgeStatus: runtime.bridgeStatus,
          latestTestimonyState: runtime.latestTestimony?.state,
        }),
        missingScopes: runtime.missingScopes,
        sessionId: runtime.session?.id ?? null,
        latestTestimonyId: runtime.latestTestimony?.id ?? null,
      },
    });

    return NextResponse.json({
      lifecycleStatus: deriveWitnessOperatorLifecycleStatus({
        accessStatus: nextAccessStatus,
        bridgeStatus: runtime.bridgeStatus,
        latestTestimonyState: runtime.latestTestimony?.state,
      }),
      bridgeStatus: runtime.bridgeStatus,
      consentStatus: runtime.consentStatus,
      missingScopes: runtime.missingScopes,
      session: runtime.session,
      latestTestimony: runtime.latestTestimony
        ? {
            id: runtime.latestTestimony.id,
            state: runtime.latestTestimony.state,
            updatedAt: runtime.latestTestimony.updatedAt,
            segmentCount: runtime.latestTestimony.segments.length,
          }
        : null,
      roundCount: runtime.session?.turns.length ?? 0,
    });
  } catch (error) {
    console.error('Witness bridge bootstrap error:', error);

    if (witnessId) {
      const failure = classifyWitnessBridgeFailure(error);

      await upsertWitnessRuntimeLink(supabaseAdmin, {
        witnessId,
        accessStatus: currentLink?.accessStatus ?? 'accepted',
        bridgeStatus: 'error',
        runtimeConsentStatus:
          failure.kind === 'consent_required'
            ? 'missing_required'
            : currentLink?.runtimeConsentStatus ?? 'unknown',
        lastBridgeError:
          error instanceof Error ? error.message : 'Witness bridge request failed.',
      });

      await logWitnessBridgeAudit(supabaseAdmin, {
        action: 'witness.bridge.error',
        actorId: witnessId,
        witnessId,
        metadata: {
          operation: 'bootstrap',
          category: failure.kind,
          retryable: failure.retryable,
          status: failure.status ?? null,
          code: failure.code ?? null,
          accessStatus: currentLink?.accessStatus ?? 'accepted',
        },
      });
    }

    return toBridgeErrorResponse(error);
  }
}
