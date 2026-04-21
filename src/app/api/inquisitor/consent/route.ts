import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  WitnessBridgeClient,
  WitnessBridgeConfigError,
  WitnessBridgeHttpError,
  grantWitnessEntryConsent,
} from '@/lib/witness-bridge/client';
import {
  logWitnessBridgeAudit,
  upsertWitnessRuntimeLink,
} from '@/lib/witness-bridge/link-state';

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

  return NextResponse.json(
    { error: 'Internal server error.' },
    { status: 500 }
  );
}

export async function POST() {
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

    const { data: acceptedTestimony } = await supabaseAdmin
      .from('testimony_records')
      .select('id')
      .eq('witness_id', profile.id)
      .eq('status', 'annotating')
      .order('created_at', { ascending: false })
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

    const bridge = new WitnessBridgeClient();
    const runtime = await grantWitnessEntryConsent(bridge, {
      witnessId: profile.id,
    });

    await upsertWitnessRuntimeLink(supabaseAdmin, {
      witnessId: profile.id,
      accessStatus: runtime.session ? 'active' : 'accepted',
      bridgeStatus: runtime.bridgeStatus,
      runtimeConsentStatus: runtime.consentStatus,
      lastBridgeError: null,
    });

    await logWitnessBridgeAudit(supabaseAdmin, {
      action: 'witness.bridge.consent_granted',
      actorId: profile.id,
      witnessId: profile.id,
      metadata: {
        bridgeStatus: runtime.bridgeStatus,
        consentStatus: runtime.consentStatus,
        missingScopes: runtime.missingScopes,
      },
    });

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Witness bridge consent error:', error);
    return toBridgeErrorResponse(error);
  }
}
