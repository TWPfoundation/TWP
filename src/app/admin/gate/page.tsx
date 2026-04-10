import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AdminGateQueue } from "@/components/admin/gate-queue";

export const metadata: Metadata = {
  title: "Admin · Gate Queue",
  description: "HCC Gateway queue — review and score Gate submissions.",
};

// Admin emails — in production, move this to DB or env
const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL || "founder@thewprotocol.online",
];

export default async function AdminGatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    redirect("/login");
  }

  // Fetch assessments awaiting review (Tier 3)
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: queue } = await supabaseAdmin
    .from("gate_assessments")
    .select(`
      id,
      tier1_score,
      tier1_reason,
      tier2_cap_tags,
      tier2_rel_tags,
      tier2_felt_tags,
      tier2_specificity,
      tier2_counterfactual,
      tier2_relational,
      final_status,
      created_at,
      witness_profiles ( pseudonym ),
      testimony_records ( de_identified_text )
    `)
    .eq("final_status", "review")
    .order("created_at", { ascending: true });

  return (
    <main className="relative min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-light tracking-widest text-foreground text-glow uppercase">
            HCC Gate Queue
          </h1>
          <p className="text-sm text-muted-foreground/60 font-sans">
            {queue?.length ?? 0} submissions awaiting Tier 3 human review
          </p>
        </div>

        <AdminGateQueue entries={queue ?? []} />
      </div>
    </main>
  );
}
