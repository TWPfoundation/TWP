"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, GitCommit, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { SectionShell } from "./section-shell";
import { StatCard } from "./stat-card";

// ── Types (must match EngineIndex from sync-engine-index.ts) ──────────────────

interface EvalSummary {
  generatedAt: string;
  provider: string;
  model: string;
  passRate: number;
  total: number;
  passed: number;
  failed: number;
  gitCommit: string;
  shortCommit: string;
  dirty: boolean;
  canonVersion: string;
  subsystems: Array<{
    subsystem: string;
    passRate: number;
    total: number;
    passed: number;
    failed: number;
  }>;
}

interface EngineIndex {
  generatedAt: string;
  canon: {
    version: string;
    lastUpdated: string;
    documentCount: number;
    recoveredArtifactCount: number;
    documents: Array<{ slug: string; title: string; type: string; status: string }>;
  };
  changelog: Array<{ filename: string; title: string; date: string }>;
  evals: EvalSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function passRateColor(rate: number) {
  if (rate >= 0.9) return "text-green-400/70";
  if (rate >= 0.7) return "text-yellow-400/70";
  return "text-red-400/70";
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EngineClient() {
  const [data, setData] = useState<EngineIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEval, setExpandedEval] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/engine");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latestEval = data?.evals?.at(-1) ?? null;

  return (
    <SectionShell
      title="Engine Health"
      subtitle="G_5.2 epistemic engine · eval & canon observability"
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 border border-border/10 hover:border-border/30 transition-all uppercase tracking-widest"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-muted-foreground/30 font-mono text-xs tracking-widest">
          fetching engine index…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="border border-red-500/20 bg-red-500/5 p-6 text-center space-y-2">
          <AlertTriangle className="w-5 h-5 text-red-400/50 mx-auto" />
          <p className="text-xs font-mono text-red-400/60">{error}</p>
          <p className="text-[10px] text-muted-foreground/30">
            Run <code>pnpm tsx scripts/sync-engine-index.ts</code> in G_5.2 to populate the engine index.
          </p>
        </div>
      )}

      {!loading && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-10"
        >
          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-border/10">
            <StatCard
              icon={Activity}
              label="Latest Pass Rate"
              value={latestEval ? pct(latestEval.passRate) : "—"}
              accent={latestEval ? passRateColor(latestEval.passRate) : undefined}
            />
            <StatCard
              icon={GitCommit}
              label="Git Commit"
              value={latestEval?.shortCommit ?? "—"}
              sub={latestEval?.dirty ? "dirty working tree" : undefined}
            />
            <StatCard
              icon={BookOpen}
              label="Canon Version"
              value={data.canon.version}
              sub={`${data.canon.documentCount} docs`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Eval Runs"
              value={data.evals.length}
              sub={latestEval ? new Date(latestEval.generatedAt).toLocaleDateString() : undefined}
            />
          </div>

          {/* Canon documents */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.25em]">
              Canon · {data.canon.documentCount} documents
            </h2>
            <div className="border border-border/10 divide-y divide-border/10">
              {data.canon.documents.map((doc) => (
                <div
                  key={doc.slug}
                  className="flex items-center justify-between px-4 py-2.5 text-xs font-mono"
                >
                  <div className="space-y-0.5">
                    <span className="text-foreground/60">{doc.title}</span>
                    <span className="block text-[9px] text-muted-foreground/30">{doc.slug}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30">{doc.type}</span>
                    <span
                      className={`text-[9px] uppercase tracking-widest ${
                        doc.status === "canonical"
                          ? "text-cyan-400/50"
                          : doc.status === "deprecated"
                          ? "text-red-400/40"
                          : "text-muted-foreground/30"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Eval history */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.25em]">
              Eval History
            </h2>
            <div className="border border-border/10 divide-y divide-border/10">
              <AnimatePresence>
                {[...data.evals].reverse().map((ev, i) => {
                  const isOpen = expandedEval === i;
                  return (
                    <motion.div key={`${ev.generatedAt}-${i}`} layout>
                      <button
                        onClick={() => setExpandedEval(isOpen ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className={`font-semibold ${passRateColor(ev.passRate)}`}>
                            {pct(ev.passRate)}
                          </span>
                          <span className="text-muted-foreground/40">{ev.shortCommit}</span>
                          <span className="text-muted-foreground/30">{ev.model}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono text-muted-foreground/30">
                            {new Date(ev.generatedAt).toLocaleDateString()}
                          </span>
                          {isOpen
                            ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
                            : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                          }
                        </div>
                      </button>

                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-4 space-y-2"
                        >
                          <div className="text-[10px] font-mono text-muted-foreground/30 grid grid-cols-3 gap-2">
                            <span>Total: <span className="text-foreground/40">{ev.total}</span></span>
                            <span>Passed: <span className="text-green-400/50">{ev.passed}</span></span>
                            <span>Failed: <span className="text-red-400/50">{ev.failed}</span></span>
                          </div>
                          {ev.subsystems.length > 0 && (
                            <div className="border border-border/10 divide-y divide-border/10 mt-2">
                              {ev.subsystems.map((sub) => (
                                <div
                                  key={sub.subsystem}
                                  className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono"
                                >
                                  <span className="text-muted-foreground/40">{sub.subsystem}</span>
                                  <span className={passRateColor(sub.passRate)}>
                                    {pct(sub.passRate)} ({sub.passed}/{sub.total})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Changelog */}
          {data.changelog.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.25em]">
                Canon Changelog
              </h2>
              <div className="border border-border/10 divide-y divide-border/10">
                {data.changelog.map((entry) => (
                  <div key={entry.filename} className="flex items-center justify-between px-4 py-2.5 text-xs font-mono">
                    <span className="text-foreground/50">{entry.title}</span>
                    <span className="text-[9px] text-muted-foreground/30">{entry.date || entry.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] font-mono text-muted-foreground/20 text-right">
            Index generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </motion.div>
      )}
    </SectionShell>
  );
}
