import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { runQualifier } from "@/lib/ai/qualifier";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/backfill-qualifier
 * 
 * Re-runs the Qualifier on accepted submissions that have empty tags
 * (crash-affected). Admin-only, passphrase-protected.
 * 
 * Optional body: { assessmentId: string } to target a single assessment.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

    if (!hasAdminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = body.assessmentId;

    // Find assessments with empty tags
    let query = supabaseAdmin
      .from("gate_assessments")
      .select(`
        id,
        submission_id,
        witness_submissions ( essay_text )
      `)
      .eq("tier2_cap_tags", "[]")
      .eq("tier2_rel_tags", "[]")
      .eq("tier2_felt_tags", "[]");

    if (targetId) {
      query = query.eq("id", targetId);
    }

    const { data: assessments, error } = await query;

    if (error) {
      console.error("[Backfill] Query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!assessments || assessments.length === 0) {
      return NextResponse.json({ message: "No assessments need backfill", backfilled: 0 });
    }

    const results: Array<{ id: string; success: boolean; tagCount?: number; error?: string }> = [];

    for (const assessment of assessments) {
      try {
        // @ts-ignore — Supabase join typing
        const essayText = assessment.witness_submissions?.essay_text;
        if (!essayText) {
          results.push({ id: assessment.id, success: false, error: "No essay text found" });
          continue;
        }

        console.log(`[Backfill] Running Qualifier for assessment ${assessment.id}...`);
        const qualifierResult = await runQualifier(essayText);
        console.log(`[Backfill] Result:`, JSON.stringify(qualifierResult, null, 2));

        const { error: updateError } = await supabaseAdmin
          .from("gate_assessments")
          .update({
            tier2_status: qualifierResult.passed ? "passed" : "failed",
            tier2_cap_tags: qualifierResult.cap_tags,
            tier2_rel_tags: qualifierResult.rel_tags,
            tier2_felt_tags: qualifierResult.felt_tags,
            tier2_specificity: qualifierResult.specificity,
            tier2_counterfactual: qualifierResult.counterfactual,
            tier2_relational: qualifierResult.relational,
            tier2_model: qualifierResult.model,
            tier2_processed_at: new Date().toISOString(),
          })
          .eq("id", assessment.id);

        if (updateError) {
          results.push({ id: assessment.id, success: false, error: updateError.message });
        } else {
          const tagCount = qualifierResult.cap_tags.length + qualifierResult.rel_tags.length + qualifierResult.felt_tags.length;
          results.push({ id: assessment.id, success: true, tagCount });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Backfill] Error for ${assessment.id}:`, msg);
        results.push({ id: assessment.id, success: false, error: msg });
      }
    }

    const backfilled = results.filter(r => r.success).length;
    return NextResponse.json({
      message: `Backfilled ${backfilled}/${results.length} assessments`,
      backfilled,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error("[Backfill] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
