import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/admin/corpus/annotate
 * 
 * Update tags, scores, and notes on a gate_assessment.
 * Used by the HCC annotation interface.
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

    if (!hasAdminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { assessmentId, cap_tags, rel_tags, felt_tags, specificity, counterfactual, relational, notes } = await request.json();

    if (!assessmentId) {
      return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("gate_assessments")
      .update({
        tier2_cap_tags: cap_tags,
        tier2_rel_tags: rel_tags,
        tier2_felt_tags: felt_tags,
        tier2_specificity: specificity,
        tier2_counterfactual: counterfactual,
        tier2_relational: relational,
        tier3_notes: notes,
      })
      .eq("id", assessmentId);

    if (error) {
      console.error("[Annotate] Update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      action: "corpus.annotate",
      actor_id: null,
      target_type: "gate_assessment",
      target_id: assessmentId,
      metadata: {
        cap_tags,
        rel_tags,
        felt_tags,
        specificity,
        counterfactual,
        relational,
        reviewer: "GOD_MODE",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Annotate] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/corpus/annotate
 * 
 * Save manual annotations to a testimony_record.
 * Used by the Corpus Manager's annotation panel.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

    if (!hasAdminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { testimonyId, annotations } = await request.json();

    if (!testimonyId || !annotations) {
      return NextResponse.json({ error: "testimonyId and annotations required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("testimony_records")
      .update({
        annotations,
        status: "annotated",
      })
      .eq("id", testimonyId);

    if (error) {
      console.error("[Corpus] Annotation update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      action: "corpus.manual_annotate",
      actor_id: null,
      target_type: "testimony_record",
      target_id: testimonyId,
      metadata: { reviewer: "GOD_MODE", tags_count: (annotations.cap_tags?.length || 0) + (annotations.rel_tags?.length || 0) + (annotations.felt_tags?.length || 0) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Corpus] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
