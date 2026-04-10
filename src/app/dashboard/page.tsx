import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Witness Protocol submission history and Gate status.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch witness profile (using service role for JOINs)
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

  // Fetch submissions with assessments
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

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending_sieve: { label: "Queued", color: "text-muted-foreground/60" },
    processing_sieve: { label: "Processing · Sieve", color: "text-amber-500/70" },
    processing_qualifier: { label: "Processing · Analysis", color: "text-amber-500/70" },
    rejected_sieve: { label: "Rejected · Sieve", color: "text-red-500/70" },
    rejected_qualifier: { label: "Rejected · Analysis", color: "text-red-500/70" },
    awaiting_review: { label: "Awaiting HCC Review", color: "text-emerald-500/70" },
    accepted: { label: "Accepted", color: "text-emerald-400/80" },
  };

  // Fetch Inquisitor sessions
  const { data: inquisitorSessions } = await supabaseAdmin
    .from("inquisitor_sessions")
    .select("id, testimony_id, session_number, status, turn_count, depth_level, created_at, completed_at")
    .eq("witness_id", profile?.id)
    .order("created_at", { ascending: false });

  const depthLabels: Record<string, string> = {
    surface: "Surface",
    intermediate: "Intermediate",
    deep: "Deep",
    philosophical: "Philosophical",
  };

  const depthColors: Record<string, string> = {
    surface: "text-blue-400/50",
    intermediate: "text-amber-400/50",
    deep: "text-orange-400/50",
    philosophical: "text-red-400/50",
  };

  return (
    <main className="relative min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-light tracking-widest text-foreground text-glow uppercase">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground/60 font-sans">
            {user.email}
          </p>
        </div>

        {/* Profile Card */}
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

        {/* Submissions */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl tracking-widest uppercase text-foreground/80">
              Submissions
            </h2>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
              {submissions?.length ?? 0} Total
            </span>
          </div>

          {(!submissions || submissions.length === 0) ? (
            <div className="border border-border/15 p-8 text-center">
              <p className="text-sm text-muted-foreground/40 font-sans">
                No submissions yet. Enter <a href="/gate" className="text-foreground/60 hover:text-foreground border-b border-border/30 hover:border-foreground/30 transition-colors">The Gate</a> to submit your testimony.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const assessment = assessments?.find((a: { submission_id: string }) => a.submission_id === sub.id);
                const statusInfo = statusLabels[sub.submission_status] || { label: sub.submission_status, color: "text-muted-foreground/60" };

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

                    {/* Gate Pipeline Visualization */}
                    {assessment && (
                      <div className="flex gap-2">
                        <div className={`flex-1 h-1 rounded-full ${
                          assessment.tier1_status === "passed" ? "bg-emerald-800/50" :
                          assessment.tier1_status === "failed" ? "bg-red-800/50" :
                          "bg-muted-foreground/10"
                        }`} title={`Tier 1: ${assessment.tier1_status}`} />
                        <div className={`flex-1 h-1 rounded-full ${
                          assessment.tier2_status === "passed" ? "bg-emerald-800/50" :
                          assessment.tier2_status === "failed" ? "bg-red-800/50" :
                          "bg-muted-foreground/10"
                        }`} title={`Tier 2: ${assessment.tier2_status}`} />
                        <div className={`flex-1 h-1 rounded-full ${
                          assessment.tier3_decision === "accept" ? "bg-emerald-800/50" :
                          assessment.tier3_decision === "reject" ? "bg-red-800/50" :
                          "bg-muted-foreground/10"
                        }`} title={`Tier 3: ${assessment.tier3_decision || "pending"}`} />
                      </div>
                    )}

                    {/* Content hash */}
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

        {/* Inquisitor Sessions */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl tracking-widest uppercase text-foreground/80">
              Inquisitor Sessions
            </h2>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
              {inquisitorSessions?.length ?? 0} Total
            </span>
          </div>

          {(!inquisitorSessions || inquisitorSessions.length === 0) ? (
            <div className="border border-border/15 p-8 text-center">
              <p className="text-sm text-muted-foreground/40 font-sans">
                No Inquisitor sessions yet. Once your testimony passes all three Gate tiers,
                you may enter{" "}
                <a href="/instrument" className="text-foreground/60 hover:text-foreground border-b border-border/30 hover:border-foreground/30 transition-colors">
                  The Instrument
                </a>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {inquisitorSessions.map((session: {
                id: string;
                session_number: number;
                status: string;
                turn_count: number;
                depth_level: string;
                created_at: string;
                completed_at: string | null;
              }) => (
                <div
                  key={session.id}
                  className="border border-border/20 p-6 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-foreground/60">
                        Session #{session.session_number}
                        <span className={`ml-3 ${
                          session.status === "active" ? "text-emerald-500/60" :
                          session.status === "paused" ? "text-amber-500/60" :
                          "text-muted-foreground/40"
                        }`}>
                          {session.status.toUpperCase()}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/30 font-sans">
                        {new Date(session.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                        {session.completed_at && ` — completed ${new Date(session.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs font-mono text-muted-foreground/40">
                        {session.turn_count}/40 turns
                      </p>
                      <p className={`text-[10px] ${depthColors[session.depth_level] || "text-muted-foreground/30"}`}>
                        {depthLabels[session.depth_level] || "Surface"}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 bg-muted-foreground/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        session.status === "active" ? "bg-emerald-800/40" :
                        session.status === "completed" ? "bg-foreground/20" :
                        "bg-amber-800/40"
                      }`}
                      style={{ width: `${(session.turn_count / 40) * 100}%` }}
                    />
                  </div>

                  {session.status === "active" && (
                    <a
                      href="/instrument"
                      className="inline-block text-[10px] text-foreground/50 hover:text-foreground transition-colors font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
                    >
                      Resume Session →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="text-center border-t border-border/10 pt-10 flex flex-col items-center gap-3">
          <a
            href="/gate"
            className="inline-flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
          >
            <span>Submit New Testimony</span>
          </a>
          <a
            href="/instrument"
            className="inline-flex items-center space-x-2 text-xs text-muted-foreground/50 hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase"
          >
            <span>Enter The Instrument</span>
          </a>
        </div>
      </div>
    </main>
  );
}

