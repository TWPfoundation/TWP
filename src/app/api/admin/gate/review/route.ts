import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/auth/admin";
import { SUBMISSION_STATUS, TESTIMONY_STATUS } from "@/lib/lifecycle";
import { upsertWitnessRuntimeLink } from "@/lib/witness-bridge/link-state";

const resend = new Resend(process.env.RESEND_API_KEY!);

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/gate/review
 *
 * HCC Tier 3 decision endpoint. Requires authenticated admin role.
 * Accepts { assessmentId, decision: "accept" | "reject" }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authenticated admin identity — no passphrase fallback
    const { user, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { assessmentId, decision } = await request.json();

    if (!assessmentId || !["accept", "reject"].includes(decision)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Update assessment with real reviewer identity
    const { error } = await supabaseAdmin
      .from("gate_assessments")
      .update({
        tier3_decision: decision,
        tier3_reviewer_a: user.userId,
        tier3_completed_at: new Date().toISOString(),
        final_status: decision === "accept" ? "passed" : "failed",
      })
      .eq("id", assessmentId);

    if (error) {
      console.error("Review update error:", error);
      return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
    }

    // Update related submission status
    const { data: assessmentData } = await supabaseAdmin
      .from("gate_assessments")
      .select(`
        submission_id,
        witness_submissions (
          witness_id,
          witness_profiles (
            supabase_user_id
          )
        )
      `)
      .eq("id", assessmentId)
      .single();

    if (assessmentData) {
      await supabaseAdmin
        .from("witness_submissions")
        .update({
          submission_status:
            decision === "accept"
              ? SUBMISSION_STATUS.ACCEPTED
              : SUBMISSION_STATUS.REJECTED_REVIEW,
        })
        .eq("id", assessmentData.submission_id);

      // If accepted, update testimony record status and notify the witness
      if (decision === "accept") {
        await supabaseAdmin
          .from("testimony_records")
          .update({ status: TESTIMONY_STATUS.ANNOTATING })
          .eq("gate_assessment_id", assessmentId);

        // Seed minimal TWP-side bridge linkage for the accepted witness.
        // Auth mapping remains owned by witness_profiles; this row stores only
        // access and bridge sync state for the governed runtime handoff.
        // @ts-ignore - joined relation typing is incomplete here
        const acceptedWitnessId = assessmentData.witness_submissions?.witness_id as string | undefined;
        if (acceptedWitnessId) {
          await upsertWitnessRuntimeLink(supabaseAdmin, {
            witnessId: acceptedWitnessId,
            accessStatus: "accepted",
            bridgeStatus: "pending",
            runtimeConsentStatus: "unknown",
            lastBridgeError: null,
          });
        }

        // Fetch witness email and send notification
        // @ts-ignore - Supabase JS typings for joined inner objects can be finicky
        const supabaseUserId = assessmentData.witness_submissions?.witness_profiles?.supabase_user_id;

        if (supabaseUserId) {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId);
          const witnessEmail = authData?.user?.email;

          if (witnessEmail) {
            await resend.emails
              .send({
                from: "The Witness Protocol <inquiry@thewprotocol.online>",
                to: witnessEmail,
                subject: "The Gate Unlocked: Testimony Accepted",
                text: `Your testimony has been accepted by the Human Curation Council.\n\nYou have fully bypassed the Gate. The Instrument is now unlocked.\n\nProceed to Phase 3: https://thewprotocol.online/instrument`,
                html: `
                <div style="font-family: monospace; background: #000; color: #fff; padding: 40px;">
                  <h1 style="color: #fff; font-size: 24px;">THE GATE UNLOCKED</h1>
                  <p style="color: #888;">Your testimony has been reviewed and accepted by the Human Curation Council.</p>
                  <p style="color: #888;">You have fully bypassed all three tiers. The Instrument is now awaiting your connection.</p>
                  <br/>
                  <a href="https://thewprotocol.online/instrument" style="background: #333; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">PROCEED TO PHASE 3</a>
                </div>
              `,
              })
              .catch((e) => console.error("Resend error:", e));
          }
        }
      }
    }

    // Audit log — records real reviewer identity, not a placeholder
    await supabaseAdmin.from("audit_log").insert({
      action: `gate.tier3.${decision}`,
      actor_id: user.userId,
      target_type: "gate_assessment",
      target_id: assessmentId,
      metadata: { decision, reviewer_email: user.email, reviewer_role: user.role },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin review error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
