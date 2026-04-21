import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getWitnessRuntimeLink,
  logWitnessLifecycleTransition,
  upsertWitnessRuntimeLink,
} from "@/lib/witness-bridge/link-state";
import { WITNESS_RUNTIME_ACCESS_STATUS } from "@/lib/witness-bridge/lifecycle";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as
      | { witnessId?: string; reason?: string }
      | null;
    const witnessId = typeof body?.witnessId === "string" ? body.witnessId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!witnessId) {
      return NextResponse.json({ error: "witnessId is required." }, { status: 400 });
    }

    const { data: witnessProfile } = await supabaseAdmin
      .from("witness_profiles")
      .select("id, pseudonym")
      .eq("id", witnessId)
      .maybeSingle();

    if (!witnessProfile) {
      return NextResponse.json({ error: "Witness profile not found." }, { status: 404 });
    }

    const currentLink = await getWitnessRuntimeLink(supabaseAdmin, witnessId);
    const { data: acceptedTestimony } = await supabaseAdmin
      .from("testimony_records")
      .select("id")
      .eq("witness_id", witnessId)
      .eq("status", "annotating")
      .limit(1)
      .maybeSingle();

    if (!currentLink && !acceptedTestimony) {
      return NextResponse.json(
        { error: "No accepted-witness control-plane linkage exists for this witness." },
        { status: 409 }
      );
    }

    await upsertWitnessRuntimeLink(supabaseAdmin, {
      witnessId,
      accessStatus: WITNESS_RUNTIME_ACCESS_STATUS.REVOKED,
    });

    await logWitnessLifecycleTransition(supabaseAdmin, {
      actorId: user.userId,
      witnessId,
      previousAccessStatus: currentLink?.accessStatus,
      nextAccessStatus: WITNESS_RUNTIME_ACCESS_STATUS.REVOKED,
      metadata: {
        via: "admin.witness_runtime.revoke",
        actorRole: user.role,
        actorEmail: user.email,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      witnessId,
      pseudonym: witnessProfile.pseudonym,
      accessStatus: WITNESS_RUNTIME_ACCESS_STATUS.REVOKED,
      alreadyRevoked:
        currentLink?.accessStatus === WITNESS_RUNTIME_ACCESS_STATUS.REVOKED,
    });
  } catch (error) {
    console.error("Admin witness revoke error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
