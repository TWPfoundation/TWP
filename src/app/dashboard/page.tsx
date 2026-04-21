import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SUBMISSION_STATUS_LABELS } from "@/lib/lifecycle";
import {
  bootstrapWitnessRuntime,
  WitnessBridgeClient,
} from "@/lib/witness-bridge/client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Witness Protocol submission history and Gate status.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from("witness_profiles")
    .select("*")
    .eq("supabase_user_id", user.id)
    .single();

  const { data: submissions } = await supabaseAdmin
    .from("witness_submissions")
    .select("id, word_count, submission_status, content_hash, created_at")
    .eq("witness_id", profile?.id)
    .order("created_at", { ascending: false });

  const { data: assessments } = await supabaseAdmin
    .from("gate_assessments")
    .select("*")
    .eq("witness_id", profile?.id)
    .order("created_at", { ascending: false });

  const { data: runtimeLink } = await supabaseAdmin
    .from("witness_runtime_links")
    .select(
      "access_status, bridge_status, runtime_consent_status, last_bridge_error, last_bridge_synced_at"
    )
    .eq("witness_id", profile?.id)
    .maybeSingle();

  const statusLabels = SUBMISSION_STATUS_LABELS;

  let runtimeSnapshot: Awaited<ReturnType<typeof bootstrapWitnessRuntime>> | null =
    null;
  let runtimeError: string | null = null;

  if (profile?.id && runtimeLink) {
    try {
      runtimeSnapshot = await bootstrapWitnessRuntime(
        new WitnessBridgeClient(),
        profile.id
      );
    } catch (error) {
      runtimeError =
        error instanceof Error
          ? error.message
          : "Governed runtime status unavailable.";
    }
  }

  return (
    <main className="relative min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-light tracking-widest text-foreground text-glow uppercase">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground/60 font-sans">
            {user.email}
          </p>
        </div>

        {profile && (
          <div className="border border-border/30 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                  Pseudonym
                </p>
                <p className="font-mono text-lg text-foreground/80 mt-1">
                  {profile.pseudonym}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                  Status
                </p>
                <p className="font-serif text-sm tracking-widest uppercase text-muted-foreground/60 mt-1">
                  {profile.status}
                </p>
              </div>
            </div>
            {profile.tier && (
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                  Tier
                </p>
                <p className="font-mono text-foreground/60 mt-1">{profile.tier}</p>
              </div>
            )}
          </div>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl tracking-widest uppercase text-foreground/80">
              Submissions
            </h2>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
              {submissions?.length ?? 0} Total
            </span>
          </div>

          {!submissions || submissions.length === 0 ? (
            <div className="border border-border/15 p-8 text-center">
              <p className="text-sm text-muted-foreground/40 font-sans">
                No submissions yet. Enter{" "}
                <a
                  href="/gate"
                  className="text-foreground/60 hover:text-foreground border-b border-border/30 hover:border-foreground/30 transition-colors"
                >
                  The Gate
                </a>{" "}
                to submit your testimony.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const assessment = assessments?.find(
                  (a: { submission_id: string }) => a.submission_id === sub.id
                );
                const statusInfo = statusLabels[sub.submission_status] || {
                  label: sub.submission_status,
                  color: "text-muted-foreground/60",
                };

                return (
                  <div
                    key={sub.id}
                    className="border border-border/20 p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className={`text-xs font-mono ${statusInfo.color}`}>
                          {statusInfo.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground/30 font-sans">
                          {new Date(sub.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground/40 font-mono">
                        {sub.word_count} words
                      </p>
                    </div>

                    {assessment && (
                      <div className="flex gap-2">
                        <div
                          className={`flex-1 h-1 rounded-full ${
                            assessment.tier1_status === "passed"
                              ? "bg-emerald-800/50"
                              : assessment.tier1_status === "failed"
                                ? "bg-red-800/50"
                                : "bg-muted-foreground/10"
                          }`}
                          title={`Tier 1: ${assessment.tier1_status}`}
                        />
                        <div
                          className={`flex-1 h-1 rounded-full ${
                            assessment.tier2_status === "passed"
                              ? "bg-emerald-800/50"
                              : assessment.tier2_status === "failed"
                                ? "bg-red-800/50"
                                : "bg-muted-foreground/10"
                          }`}
                          title={`Tier 2: ${assessment.tier2_status}`}
                        />
                        <div
                          className={`flex-1 h-1 rounded-full ${
                            assessment.tier3_decision === "accept"
                              ? "bg-emerald-800/50"
                              : assessment.tier3_decision === "reject"
                                ? "bg-red-800/50"
                                : "bg-muted-foreground/10"
                          }`}
                          title={`Tier 3: ${assessment.tier3_decision || "pending"}`}
                        />
                      </div>
                    )}

                    {sub.content_hash && (
                      <p className="text-[9px] text-muted-foreground/20 font-mono truncate">
                        SHA-256: {sub.content_hash}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl tracking-widest uppercase text-foreground/80">
              Governed Runtime
            </h2>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
              {runtimeLink ? (runtimeSnapshot?.session ? "Live" : "Linked") : "Pending"}
            </span>
          </div>

          {!runtimeLink ? (
            <div className="border border-border/15 p-8 text-center">
              <p className="text-sm text-muted-foreground/40 font-sans">
                No governed runtime linkage yet. Once your testimony passes all three
                Gate tiers, TWP will route your accepted-witness session into G_5.2.
              </p>
            </div>
          ) : runtimeError ? (
            <div className="border border-border/15 p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground/40 font-sans">
                {runtimeError}
              </p>
              {runtimeLink.last_bridge_error && (
                <p className="text-[10px] text-muted-foreground/25 font-mono">
                  Last bridge error: {runtimeLink.last_bridge_error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-border/20 p-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                      Bridge Status
                    </p>
                    <p className="mt-1 font-mono text-sm text-foreground/70">
                      {runtimeSnapshot?.bridgeStatus ?? runtimeLink.bridge_status}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                      Consent Mirror
                    </p>
                    <p className="mt-1 font-mono text-sm text-foreground/70">
                      {runtimeSnapshot?.consentStatus ??
                        runtimeLink.runtime_consent_status}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                      Access
                    </p>
                    <p className="mt-1 font-mono text-sm text-foreground/70">
                      {runtimeLink.access_status}
                    </p>
                  </div>
                </div>

                {runtimeSnapshot?.latestTestimony && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                        Runtime Testimony
                      </p>
                      <p className="mt-1 font-mono text-sm text-foreground/70">
                        {runtimeSnapshot.latestTestimony.state}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                        Segments
                      </p>
                      <p className="mt-1 font-mono text-sm text-foreground/70">
                        {runtimeSnapshot.latestTestimony.segments.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                        Session Rounds
                      </p>
                      <p className="mt-1 font-mono text-sm text-foreground/70">
                        {runtimeSnapshot.session?.turns.length ?? 0}
                      </p>
                    </div>
                  </div>
                )}

                {runtimeSnapshot?.missingScopes?.length ? (
                  <p className="text-xs text-amber-500/60 font-mono">
                    Missing runtime scopes: {runtimeSnapshot.missingScopes.join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/35 font-sans">
                    Runtime artifacts remain in G_5.2. TWP is showing only minimal
                    bridge status.
                  </p>
                )}
              </div>

              <div className="border border-border/15 p-8 text-center">
                <p className="text-sm text-muted-foreground/40 font-sans">
                  Continue through{" "}
                  <a
                    href="/instrument"
                    className="text-foreground/60 hover:text-foreground border-b border-border/30 hover:border-foreground/30 transition-colors"
                  >
                    The Instrument
                  </a>{" "}
                  to enter the governed Witness runtime.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="text-center border-t border-border/10 pt-10 flex flex-col items-center gap-3">
          <a
            href="/gate"
            className="inline-flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
          >
            <span>Submit New Testimony</span>
          </a>
          <a
            href="/instrument"
            className="inline-flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
          >
            <span>Enter The Instrument</span>
          </a>
          <a
            href="/dashboard/consent"
            className="inline-flex items-center space-x-2 text-xs text-muted-foreground/50 hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase"
          >
            <span>Manage Consent Preferences</span>
          </a>
        </div>
      </div>
    </main>
  );
}
