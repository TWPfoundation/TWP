import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminDashboardClient } from "@/components/admin/dashboard-client";
import { SUBMISSION_STATUS, ASSESSMENT_STATUS } from "@/lib/lifecycle";

export const metadata: Metadata = {
  title: "Admin · Dashboard",
  description: "TWP Administrative Dashboard — corpus statistics and bridge health.",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminDashboardPage() {
  const auth = await requireAdmin();
  if (auth.error) redirect("/admin/login");

  const [
    { count: totalSubmissions },
    { count: acceptedCount },
    { count: rejectedCount },
    { count: pendingReviewCount },
    { count: invitedWitnessCount },
    { count: activeWitnessCount },
    { count: completedWitnessCount },
    { count: revokedWitnessCount },
    { count: bridgeReadyCount },
    { count: bridgeErrorCount },
    { data: assessments },
    { data: recentAudit },
    { data: runtimeLinks },
  ] = await Promise.all([
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }).eq("submission_status", SUBMISSION_STATUS.ACCEPTED),
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }).in("submission_status", [SUBMISSION_STATUS.REJECTED_SIEVE, SUBMISSION_STATUS.REJECTED_QUALIFIER, SUBMISSION_STATUS.REJECTED_REVIEW]),
    supabaseAdmin.from("gate_assessments").select("*", { count: "exact", head: true }).eq("final_status", ASSESSMENT_STATUS.REVIEW),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).eq("access_status", "invited"),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).eq("access_status", "active"),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).eq("access_status", "completed"),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).eq("access_status", "revoked"),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).in("bridge_status", ["ready", "active"]),
    supabaseAdmin.from("witness_runtime_links").select("*", { count: "exact", head: true }).eq("bridge_status", "error"),
    supabaseAdmin.from("gate_assessments").select("tier2_cap_tags, tier2_rel_tags, tier2_felt_tags, tier2_specificity, tier2_counterfactual, tier2_relational, tier1_score, final_status, created_at"),
    supabaseAdmin.from("audit_log").select("action, created_at, metadata").order("created_at", { ascending: false }).limit(20),
    supabaseAdmin
      .from("witness_runtime_links")
      .select(
        "witness_id, access_status, bridge_status, runtime_consent_status, last_bridge_error, last_bridge_synced_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const runtimeWitnessIds = (runtimeLinks ?? []).map((entry) => entry.witness_id);
  const { data: runtimeProfiles } = runtimeWitnessIds.length
    ? await supabaseAdmin
        .from("witness_profiles")
        .select("id, pseudonym, status")
        .in("id", runtimeWitnessIds)
    : { data: [] as Array<{ id: string; pseudonym: string; status: string | null }> };

  const runtimeProfileById = new Map(
    (runtimeProfiles ?? []).map((profile) => [profile.id, profile])
  );

  const tagFreq: Record<string, number> = {};
  const scores: { specificity: number[]; counterfactual: number[]; relational: number[] } = {
    specificity: [],
    counterfactual: [],
    relational: [],
  };

  assessments?.forEach((a) => {
    (a.tier2_cap_tags || []).forEach((t: string) => {
      tagFreq[`CAP:${t}`] = (tagFreq[`CAP:${t}`] || 0) + 1;
    });
    (a.tier2_rel_tags || []).forEach((t: string) => {
      tagFreq[`REL:${t}`] = (tagFreq[`REL:${t}`] || 0) + 1;
    });
    (a.tier2_felt_tags || []).forEach((t: string) => {
      tagFreq[`FELT:${t}`] = (tagFreq[`FELT:${t}`] || 0) + 1;
    });
    if (a.tier2_specificity != null) scores.specificity.push(Number(a.tier2_specificity));
    if (a.tier2_counterfactual != null) scores.counterfactual.push(Number(a.tier2_counterfactual));
    if (a.tier2_relational != null) scores.relational.push(Number(a.tier2_relational));
  });

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
      : 0;

  const topTags = Object.entries(tagFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const stats = {
    totalSubmissions: totalSubmissions ?? 0,
    accepted: acceptedCount ?? 0,
    rejected: rejectedCount ?? 0,
    pendingReview: pendingReviewCount ?? 0,
    invitedWitnesses: invitedWitnessCount ?? 0,
    activeWitnesses: activeWitnessCount ?? 0,
    completedWitnesses: completedWitnessCount ?? 0,
    revokedWitnesses: revokedWitnessCount ?? 0,
    bridgeReady: bridgeReadyCount ?? 0,
    bridgeErrors: bridgeErrorCount ?? 0,
    avgSpecificity: avg(scores.specificity),
    avgCounterfactual: avg(scores.counterfactual),
    avgRelational: avg(scores.relational),
    topTags,
    runtimeControls: (runtimeLinks ?? []).map((entry) => {
      const profile = runtimeProfileById.get(entry.witness_id);

      return {
        witnessId: entry.witness_id,
        pseudonym: profile?.pseudonym ?? "Unknown",
        witnessStatus: profile?.status ?? null,
        accessStatus: entry.access_status,
        bridgeStatus: entry.bridge_status,
        consentStatus: entry.runtime_consent_status,
        lastBridgeError: entry.last_bridge_error,
        lastBridgeSyncedAt: entry.last_bridge_synced_at,
        updatedAt: entry.updated_at,
      };
    }),
    recentActivity: (recentAudit || []).map((r) => ({
      action: r.action,
      time: r.created_at,
      meta: r.metadata,
    })),
  };

  return <AdminDashboardClient stats={stats} />;
}
