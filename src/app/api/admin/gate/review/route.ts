import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { cookies } from "next/headers";

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL || "founder@thewprotocol.online",
  "martinusvand@gmail.com",
  "vandeursenmart@gmail.com", 
  "gfxuser5@gmail.com"
];

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/gate/review
 * 
 * HCC Tier 3 decision endpoint. Admin-only.
 * Accepts { assessmentId, decision: "accept" | "reject" }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const cookieStore = cookies();
    const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

    if (!hasAdminToken && (!user || !ADMIN_EMAILS.includes(user.email || ""))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const reviewerId = user ? user.id : null;
    const reviewerEmail = user ? user.email : "GOD_MODE_PASSPHRASE";

    const { assessmentId, decision } = await request.json();

    if (!assessmentId || !["accept", "reject"].includes(decision)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Update assessment
    const { error } = await supabaseAdmin
      .from("gate_assessments")
      .update({
        tier3_decision: decision,
        tier3_reviewer_a: reviewerId,
        tier3_completed_at: new Date().toISOString(),
        final_status: decision === "accept" ? "passed" : "failed",
      })
      .eq("id", assessmentId);

    if (error) {
      console.error("Review update error:", error);
      return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
    }

    // Update related submission status
    const { data: assessment } = await supabaseAdmin
      .from("gate_assessments")
      .select("submission_id")
      .eq("id", assessmentId)
      .single();

    if (assessment) {
      await supabaseAdmin
        .from("witness_submissions")
        .update({
          submission_status: decision === "accept" ? "accepted" : "rejected_review",
        })
        .eq("id", assessment.submission_id);

      // If accepted, update testimony record status
      if (decision === "accept") {
        await supabaseAdmin
          .from("testimony_records")
          .update({ status: "annotating" })
          .eq("gate_assessment_id", assessmentId);
      }
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      action: `gate.tier3.${decision}`,
      actor_id: reviewerId,
      target_type: "gate_assessment",
      target_id: assessmentId,
      metadata: { decision, reviewer_email: reviewerEmail },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin review error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
