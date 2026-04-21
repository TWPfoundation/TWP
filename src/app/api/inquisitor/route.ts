import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
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
  isWitnessRuntimeAccessBlocked,
  WITNESS_RUNTIME_ACCESS_STATUS,
} from '@/lib/witness-bridge/lifecycle';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toBridgeErrorResponse(error: unknown, witnessId?: string) {
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
        ...(witnessId ? { witnessId } : {}),
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error.' },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  let witnessId: string | undefined;
  let currentLink: Awaited<ReturnType<typeof getWitnessRuntimeLink>> = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('witness_profiles')
      .select('id')
      .eq('supabase_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Witness profile not found.' },
        { status: 404 }
      );
    }

    witnessId = profile.id;
    currentLink = await getWitnessRuntimeLink(supabaseAdmin, profile.id);

    if (isWitnessRuntimeAccessBlocked(currentLink?.accessStatus)) {
      return NextResponse.json(
        { error: 'Witness runtime access has been revoked.' },
        { status: 403 }
      );
    }

    if (currentLink?.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.COMPLETED) {
      return NextResponse.json(
        { error: 'Witness runtime is already completed for this accepted witness.' },
        { status: 409 }
      );
    }

    const { sessionId, testimonyId, message } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const acceptedTestimonyId =
      typeof testimonyId === 'string' && testimonyId.trim()
        ? testimonyId.trim()
        : null;

    if (acceptedTestimonyId) {
      const { data: acceptedTestimony } = await supabaseAdmin
        .from('testimony_records')
        .select('id')
        .eq('id', acceptedTestimonyId)
        .eq('witness_id', profile.id)
        .eq('status', 'annotating')
        .single();

      if (!acceptedTestimony) {
        return NextResponse.json(
          {
            error:
              'The Instrument is only accessible after your testimony has been accepted through The Gate.',
          },
          { status: 403 }
        );
      }
    } else {
      const { data: acceptedTestimony } = await supabaseAdmin
        .from('testimony_records')
        .select('id')
        .eq('witness_id', profile.id)
        .eq('status', 'annotating')
        .limit(1)
        .single();

      if (!acceptedTestimony) {
        return NextResponse.json(
          {
            error:
              'The Instrument is only accessible after your testimony has been accepted through The Gate.',
          },
          { status: 403 }
        );
      }
    }

    const bridge = new WitnessBridgeClient();
    const result = await bridge.submitWitnessTurn({
      witnessId: profile.id,
      sessionId:
        typeof sessionId === 'string' && sessionId.trim()
          ? sessionId.trim()
          : undefined,
      userMessage: message.trim(),
    });
    const nextAccessStatus = deriveWitnessAccessStatus({
      currentAccessStatus: currentLink?.accessStatus,
      hasSession: true,
      latestTestimonyState: null,
    });

    await upsertWitnessRuntimeLink(supabaseAdmin, {
      witnessId: profile.id,
      accessStatus: nextAccessStatus,
      bridgeStatus: 'active',
      runtimeConsentStatus: 'ready',
      lastBridgeError: null,
    });

    await logWitnessLifecycleTransition(supabaseAdmin, {
      actorId: profile.id,
      witnessId: profile.id,
      previousAccessStatus: currentLink?.accessStatus,
      nextAccessStatus,
      metadata: {
        via: 'witness.bridge.turn',
        testimonyId: result.testimonyId ?? null,
      },
    });

    await logWitnessBridgeAudit(supabaseAdmin, {
      action: 'witness.bridge.turn',
      actorId: profile.id,
      witnessId: profile.id,
      metadata: {
        sessionId: result.session.id,
        testimonyId: result.testimonyId ?? null,
        persistedTurnId: result.persistedTurn.id,
      },
    });

    return NextResponse.json({
      session: result.session,
      persistedTurn: result.persistedTurn,
      testimonyId: result.testimonyId ?? null,
      roundCount: result.session.turns.length,
    });
  } catch (error) {
    console.error('Witness bridge turn error:', error);

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
          operation: 'turn',
          category: failure.kind,
          retryable: failure.retryable,
          status: failure.status ?? null,
          code: failure.code ?? null,
          accessStatus: currentLink?.accessStatus ?? 'accepted',
        },
      });
    }

    return toBridgeErrorResponse(error, witnessId);
  }
}
