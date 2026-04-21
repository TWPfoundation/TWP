import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { InstrumentClient } from "./instrument-client";
import { WITNESS_RUNTIME_ACCESS_STATUS } from "@/lib/witness-bridge/lifecycle";

export const metadata: Metadata = {
  title: "The Instrument",
  description: "The Inquisitor — a xenopsychologist dialogue engine for structured moral inquiry.",
};

export default async function InstrumentPage() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get witness profile
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from("witness_profiles")
    .select("id")
    .eq("supabase_user_id", user.id)
    .single();

  if (!profile) {
    redirect("/gate");
  }

  const { data: runtimeLink } = await supabaseAdmin
    .from("witness_runtime_links")
    .select("access_status")
    .eq("witness_id", profile.id)
    .maybeSingle();

  if (runtimeLink?.access_status === WITNESS_RUNTIME_ACCESS_STATUS.REVOKED) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-light tracking-widest text-foreground text-glow uppercase">
            The Instrument
          </h1>
          <p className="text-muted-foreground/60 font-sans text-sm leading-relaxed">
            Governed Witness access has been disabled in the TWP control plane.
            Runtime artifacts remain preserved in G_5.2, but new entry and turn
            actions are closed.
          </p>
          <div className="flex flex-col items-center gap-3 pt-4">
            <a
              href="/dashboard"
              className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Gate passage check — find accepted testimony
  const { data: acceptedTestimony } = await supabaseAdmin
    .from("testimony_records")
    .select("id, de_identified_text")
    .eq("witness_id", profile.id)
    .eq("status", "annotating") // Accepted through Gate
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!acceptedTestimony) {
    // No accepted testimony — witness hasn't passed the Gate yet
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-light tracking-widest text-foreground text-glow uppercase">
            The Instrument
          </h1>
          <p className="text-muted-foreground/60 font-sans text-sm leading-relaxed">
            The Inquisitor is only accessible after your testimony has passed
            all three tiers of The Gate. Your submission is either still being
            reviewed or has not yet been accepted.
          </p>
          <div className="flex flex-col items-center gap-3 pt-4">
            <a
              href="/dashboard"
              className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
            >
              Check Dashboard for Status
            </a>
            <a
              href="/gate"
              className="text-xs text-muted-foreground/40 hover:text-foreground transition-colors font-serif tracking-widest uppercase"
            >
              Return to Gate
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <InstrumentClient
      testimonyId={acceptedTestimony.id}
      testimonyPreview={acceptedTestimony.de_identified_text.slice(0, 200) + "..."}
    />
  );
}
