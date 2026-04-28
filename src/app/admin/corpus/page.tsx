import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { CorpusClient } from "@/components/admin/corpus-client";

export const metadata: Metadata = {
  title: "Admin · Corpus",
  description: "Review and annotate accepted testimonies in the corpus.",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function CorpusPage() {
  const auth = await requireAdmin();
  if (auth.error) redirect("/admin/login");

  // Fetch accepted testimonies with their assessments
  const { data: testimonies, error } = await supabaseAdmin
    .from("testimony_records")
    .select(`
      id,
      de_identified_text,
      status,
      annotations,
      created_at,
      gate_assessments!testimony_records_gate_assessment_id_fkey (
        tier1_score,
        tier2_cap_tags,
        tier2_rel_tags,
        tier2_felt_tags,
        tier2_specificity,
        tier2_counterfactual,
        tier2_relational,
        final_status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Corpus] Query error:", error);
  }

  return <CorpusClient testimonies={testimonies ?? []} />;
}
