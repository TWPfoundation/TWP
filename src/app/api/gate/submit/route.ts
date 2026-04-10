import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gateSubmissionSchema } from "@/lib/utils/validation";
import { hashTestimony } from "@/lib/utils/pseudonym";
import { runSieve } from "@/lib/ai/sieve";
import { runQualifier } from "@/lib/ai/qualifier";
import { detectAndStripPII } from "@/lib/ai/pii";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Service role client for database operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/gate/submit
 * 
 * Authenticated Gate submission pipeline:
 * 1. Validate auth session
 * 2. Validate essay (Zod schema)
 * 3. Hash content for tamper detection
 * 4. Insert submission into witness_submissions
 * 5. Run Tier 1: AI Sieve (async, non-blocking)
 * 6. If Sieve passes → Run Tier 2: AI Qualifier
 * 7. Create gate_assessment record
 * 8. If both tiers pass → Run PII stripping → Create testimony_record
 * 9. Audit log everything
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    // Get witness profile
    const { data: profile } = await supabaseAdmin
      .from("witness_profiles")
      .select("id, pseudonym, status")
      .eq("supabase_user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Witness profile not found. Please contact support." },
        { status: 404 }
      );
    }

    // 2. Validate body
    const body = await request.json();
    const parsed = gateSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid submission" },
        { status: 400 }
      );
    }

    const { essay_text } = parsed.data;
    const wordCount = essay_text.trim().split(/\s+/).length;

    // 3. Hash content
    const contentHash = hashTestimony(essay_text);

    // Check for duplicate submissions
    const { data: existing } = await supabaseAdmin
      .from("witness_submissions")
      .select("id")
      .eq("content_hash", contentHash)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This testimony has already been submitted." },
        { status: 409 }
      );
    }

    // 4. Insert submission
    const { data: submission, error: insertError } = await supabaseAdmin
      .from("witness_submissions")
      .insert({
        essay_text,
        word_count: wordCount,
        content_hash: contentHash,
        witness_id: profile.id,
        submission_status: "processing_sieve",
      })
      .select("id")
      .single();

    if (insertError || !submission) {
      console.error("Submission insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to record submission." },
        { status: 500 }
      );
    }

    // 5. Run Tier 1: AI Sieve
    let sieveResult;
    try {
      sieveResult = await runSieve(essay_text);
    } catch (err) {
      console.error("Sieve error:", err);
      // Don't fail the submission — mark as needing manual review
      sieveResult = { passed: false, score: 0, reason: "Sieve processing failed — flagged for manual review", flags: ["sieve_error"], model: "error" };
    }

    // Create gate assessment record
    const { data: assessment, error: assessmentError } = await supabaseAdmin
      .from("gate_assessments")
      .insert({
        submission_id: submission.id,
        witness_id: profile.id,
        tier1_status: sieveResult.passed ? "passed" : "failed",
        tier1_score: sieveResult.score,
        tier1_reason: sieveResult.reason,
        tier1_model: sieveResult.model,
        tier1_processed_at: new Date().toISOString(),
        final_status: sieveResult.passed ? "pending" : "failed",
      })
      .select("id")
      .single();

    if (assessmentError) {
      console.error("Assessment insert error:", assessmentError);
    }

    // 6. If Sieve passes → Run Tier 2: AI Qualifier
    let qualifierResult;
    let qualifierError: string | null = null;
    if (sieveResult.passed && assessment) {
      try {
        console.log("[Gate] Running Tier 2 Qualifier for submission:", submission.id);
        qualifierResult = await runQualifier(essay_text);
        console.log("[Gate] Qualifier result:", JSON.stringify(qualifierResult, null, 2));

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
            final_status: qualifierResult.passed ? "review" : "failed",
          })
          .eq("id", assessment.id);

        if (updateError) {
          console.error("[Gate] Qualifier DB update error:", updateError);
          qualifierError = `DB update failed: ${updateError.message}`;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[Gate] Qualifier execution CRASHED:", errorMsg, err);
        qualifierError = errorMsg;
        
        // Don't treat a crash as a rejection — forward to HCC review
        qualifierResult = {
          passed: true, // Give benefit of doubt on API failure
          cap_tags: [],
          rel_tags: [],
          felt_tags: [],
          specificity: 0,
          counterfactual: 0,
          relational: 0,
          summary: `Qualifier API error — forwarded to HCC review. Error: ${errorMsg}`,
          model: "error",
        };

        // Still update the assessment to reflect the error state
        await supabaseAdmin
          .from("gate_assessments")
          .update({
            tier2_status: "passed",
            tier2_processed_at: new Date().toISOString(),
            final_status: "review",
          })
          .eq("id", assessment.id);
      }
    }

    // 7. If both tiers pass → PII strip + create testimony record
    if (sieveResult.passed && qualifierResult?.passed && assessment) {
      try {
        const piiResult = await detectAndStripPII(essay_text);

        await supabaseAdmin
          .from("testimony_records")
          .insert({
            content_hash: contentHash,
            witness_id: profile.id,
            de_identified_text: piiResult.deIdentifiedText,
            original_submission_id: submission.id,
            gate_assessment_id: assessment.id,
            status: "gated",
          });

        // Update submission status
        await supabaseAdmin
          .from("witness_submissions")
          .update({ submission_status: "awaiting_review" })
          .eq("id", submission.id);
      } catch (err) {
        console.error("PII/Testimony error:", err);
      }
    } else {
      // Update submission status to reflect Gate outcome
      await supabaseAdmin
        .from("witness_submissions")
        .update({
          submission_status: sieveResult.passed ? "processing_qualifier" : "rejected_sieve",
        })
        .eq("id", submission.id);
    }

    // 8. Audit log
    await supabaseAdmin.from("audit_log").insert({
      action: "gate.submit",
      actor_id: profile.id,
      target_type: "witness_submission",
      target_id: submission.id,
      metadata: {
        content_hash: contentHash,
        word_count: wordCount,
        tier1_passed: sieveResult.passed,
        tier1_score: sieveResult.score,
        tier2_passed: qualifierResult?.passed ?? null,
        pseudonym: profile.pseudonym,
      },
    });

    // Response
    const gateStatus = (() => {
      if (!sieveResult.passed) return "rejected_sieve";
      if (!qualifierResult) return "error_qualifier";
      if (!qualifierResult.passed) return "rejected_qualifier";
      return "awaiting_review";
    })();

    console.log("[Gate] Final status:", gateStatus, "qualifier passed:", qualifierResult?.passed);

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      status: gateStatus,
      pseudonym: profile.pseudonym,
      tier1: {
        passed: sieveResult.passed,
        score: sieveResult.score,
      },
      tier2: qualifierResult ? {
        passed: qualifierResult.passed,
        tags: {
          cap: qualifierResult.cap_tags.length,
          rel: qualifierResult.rel_tags.length,
          felt: qualifierResult.felt_tags.length,
        },
      } : null,
      ...(qualifierError ? { qualifierError } : {}),
    });
  } catch (err) {
    console.error("Gate submission error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
