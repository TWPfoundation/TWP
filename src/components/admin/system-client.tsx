"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Zap } from "lucide-react";
import { SectionShell } from "./section-shell";
import { StatCard } from "./stat-card";

interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "error";
  latencyMs?: number;
  detail?: string;
}

interface SystemHealth {
  status: "ok" | "degraded" | "error";
  checkedAt: string;
  checks: HealthCheck[];
}

function StatusIcon({ status }: { status: HealthCheck["status"] }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-green-400/60" />;
  if (status === "degraded") return <AlertTriangle className="w-4 h-4 text-yellow-400/60" />;
  return <XCircle className="w-4 h-4 text-red-400/60" />;
}

function statusColor(status: HealthCheck["status"]) {
  if (status === "ok") return "text-green-400/60";
  if (status === "degraded") return "text-yellow-400/60";
  return "text-red-400/60";
}

function friendlyName(name: string) {
  const map: Record<string, string> = {
    env_config: "Env Config",
    supabase: "Supabase DB",
    s3_storage: "S3 Storage",
    openai: "OpenAI API",
  };
  return map[name] ?? name;
}

export function SystemClient() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const okCount = data?.checks.filter((c) => c.status === "ok").length ?? 0;
  const totalCount = data?.checks.length ?? 0;
  const avgLatency = data?.checks
    .filter((c) => c.latencyMs !== undefined)
    .reduce((acc, c, _, arr) => acc + (c.latencyMs! / arr.length), 0);

  return (
    <SectionShell
      title="System Config"
      subtitle="Operational health · connectivity monitor"
      actions={
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 border border-border/10 hover:border-border/30 transition-all uppercase tracking-widest">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px border border-border/10">
        <StatCard
          icon={Settings}
          label="Overall Status"
          value={data?.status?.toUpperCase() ?? "—"}
          accent={data?.status === "ok" ? "text-green-400/60" : data?.status === "degraded" ? "text-yellow-400/60" : "text-red-400/60"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Checks Passing"
          value={data ? `${okCount} / ${totalCount}` : "—"}
        />
        <StatCard
          icon={Zap}
          label="Avg Latency"
          value={avgLatency !== undefined && data ? `${Math.round(avgLatency)} ms` : "—"}
          accent="text-cyan-400/40"
        />
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="border border-red-500/20 bg-red-500/5 p-6 text-center space-y-2">
          <AlertTriangle className="w-5 h-5 text-red-400/50 mx-auto" />
          <p className="text-xs font-mono text-red-400/60">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-muted-foreground/30 font-mono text-xs tracking-widest">
          running health checks…
        </div>
      )}

      {!loading && data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <h2 className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.25em]">
            Service Checks
          </h2>
          <div className="border border-border/10 divide-y divide-border/10">
            {data.checks.map((check) => (
              <div key={check.name}
                className="flex items-center justify-between px-4 py-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <StatusIcon status={check.status} />
                  <div>
                    <p className="text-foreground/60">{friendlyName(check.name)}</p>
                    {check.detail && (
                      <p className="text-[10px] text-muted-foreground/30 mt-0.5">{check.detail}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {check.latencyMs !== undefined && (
                    <span className="text-[9px] text-muted-foreground/30 tabular-nums">
                      {check.latencyMs} ms
                    </span>
                  )}
                  <span className={`text-[9px] uppercase tracking-widest ${statusColor(check.status)}`}>
                    {check.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] font-mono text-muted-foreground/20 text-right">
            Checked at {new Date(data.checkedAt).toLocaleString()}
          </p>
        </motion.div>
      )}
    </SectionShell>
  );
}
