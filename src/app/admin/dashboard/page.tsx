import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { AdminDashboardClient } from "@/components/admin/dashboard-client";

export const metadata: Metadata = {
  title: "Admin · Dashboard",
  description: "TWP Administrative Dashboard — corpus statistics and system health.",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

  if (!hasAdminToken) {
    redirect("/admin/login");
  }

  // Gather statistics
  const [
    { count: totalSubmissions },
    { count: acceptedCount },
    { count: rejectedCount },
    { count: pendingReviewCount },
    { count: totalSessions },
    { data: assessments },
    { data: recentAudit },
  ] = await Promise.all([
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }).eq("submission_status", "accepted"),
    supabaseAdmin.from("witness_submissions").select("*", { count: "exact", head: true }).in("submission_status", ["rejected_sieve", "rejected_qualifier", "rejected_review"]),
    supabaseAdmin.from("gate_assessments").select("*", { count: "exact", head: true }).eq("final_status", "review"),
    supabaseAdmin.from("inquisitor_sessions").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("gate_assessments").select("tier2_cap_tags, tier2_rel_tags, tier2_felt_tags, tier2_specificity, tier2_counterfactual, tier2_relational, tier1_score, final_status, created_at"),
    supabaseAdmin.from("audit_log").select("action, created_at, metadata").order("created_at", { ascending: false }).limit(20),
  ]);

  // Compute tag frequencies
  const tagFreq: Record<string, number> = {};
  const scores: { specificity: number[]; counterfactual: number[]; relational: number[] } = {
    specificity: [], counterfactual: [], relational: [],
  };

  assessments?.forEach((a) => {
    (a.tier2_cap_tags || []).forEach((t: string) => { tagFreq[`CAP:${t}`] = (tagFreq[`CAP:${t}`] || 0) + 1; });
    (a.tier2_rel_tags || []).forEach((t: string) => { tagFreq[`REL:${t}`] = (tagFreq[`REL:${t}`] || 0) + 1; });
    (a.tier2_felt_tags || []).forEach((t: string) => { tagFreq[`FELT:${t}`] = (tagFreq[`FELT:${t}`] || 0) + 1; });
    if (a.tier2_specificity != null) scores.specificity.push(Number(a.tier2_specificity));
    if (a.tier2_counterfactual != null) scores.counterfactual.push(Number(a.tier2_counterfactual));
    if (a.tier2_relational != null) scores.relational.push(Number(a.tier2_relational));
  });

  const avg = (arr: number[]) => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

  const topTags = Object.entries(tagFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const stats = {
    totalSubmissions: totalSubmissions ?? 0,
    accepted: acceptedCount ?? 0,
    rejected: rejectedCount ?? 0,
    pendingReview: pendingReviewCount ?? 0,
    totalSessions: totalSessions ?? 0,
    avgSpecificity: avg(scores.specificity),
    avgCounterfactual: avg(scores.counterfactual),
    avgRelational: avg(scores.relational),
    topTags,
    recentActivity: (recentAudit || []).map((r) => ({
      action: r.action,
      time: r.created_at,
      meta: r.metadata,
    })),
  };

  return <AdminDashboardClient stats={stats} />;
}
