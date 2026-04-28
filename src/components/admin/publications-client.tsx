"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileArchive,
  Download,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { SectionShell } from "./section-shell";
import { StatCard } from "./stat-card";

interface S3Object {
  key: string;
  size?: number;
  lastModified?: string;
  downloadUrl: string;
}

interface PublicationsResponse {
  objects: S3Object[];
  count: number;
  truncated: boolean;
  nextCursor: string | null;
  prefix: string;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function keyBasename(key: string) {
  return key.split("/").filter(Boolean).pop() ?? key;
}

function keyPrefix(key: string) {
  const parts = key.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/") || "/";
}

export function PublicationsClient() {
  const [data, setData] = useState<PublicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allObjects, setAllObjects] = useState<S3Object[]>([]);
  const [prefix, setPrefix] = useState("witnesses/");
  const [prefixInput, setPrefixInput] = useState("witnesses/");

  const load = useCallback(async (nextCursor?: string | null, resetObjects = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ prefix });
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/publications?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json: PublicationsResponse = await res.json();
      setData(json);
      setAllObjects((prev) => (resetObjects ? json.objects : [...prev, ...json.objects]));
      setCursor(json.nextCursor);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => { load(); }, [load]);

  const handlePrefixSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPrefix(prefixInput);
  };

  return (
    <SectionShell
      title="Publications"
      subtitle="Witness publication archive · S3 storage browser"
      actions={
        <button onClick={() => load(null, true)} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 border border-border/10 hover:border-border/30 transition-all uppercase tracking-widest">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px border border-border/10">
        <StatCard icon={FileArchive} label="Objects" value={data?.count ?? "—"} sub={data?.truncated ? "more available" : "all loaded"} />
        <StatCard icon={FolderOpen} label="Prefix" value={prefix} />
        <StatCard icon={Download} label="Signed URLs" value="5 min TTL" accent="text-cyan-400/40" />
      </div>

      <form onSubmit={handlePrefixSearch} className="flex gap-2">
        <input type="text" value={prefixInput} onChange={(e) => setPrefixInput(e.target.value)}
          placeholder="S3 prefix filter…"
          className="flex-1 bg-white/[0.02] border border-border/10 px-3 py-2 text-xs font-mono text-foreground/60 placeholder:text-muted-foreground/20 focus:outline-none focus:border-cyan-500/30 transition-colors" />
        <button type="submit"
          className="px-4 py-2 text-[10px] font-mono border border-border/10 hover:border-cyan-500/30 text-muted-foreground/40 hover:text-cyan-400/60 transition-all uppercase tracking-widest flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" /> Filter
        </button>
      </form>

      {!loading && error && (
        <div className="border border-red-500/20 bg-red-500/5 p-6 text-center space-y-2">
          <AlertTriangle className="w-5 h-5 text-red-400/50 mx-auto" />
          <p className="text-xs font-mono text-red-400/60">{error}</p>
        </div>
      )}
      {loading && (
        <div className="text-center py-16 text-muted-foreground/30 font-mono text-xs tracking-widest">querying storage…</div>
      )}
      {!loading && allObjects.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground/30 font-mono text-xs tracking-widest">
          no objects found under prefix "{prefix}"
        </div>
      )}

      {allObjects.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-px">
          <div className="border border-border/10">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[9px] font-mono text-muted-foreground/20 uppercase tracking-widest border-b border-border/10">
              <span>Key</span><span>Folder</span><span>Size</span><span>Modified</span>
            </div>
            {allObjects.map((obj) => (
              <motion.a key={obj.key} href={obj.downloadUrl} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 text-xs font-mono hover:bg-white/[0.02] border-b border-border/5 last:border-0 group transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Download className="w-3 h-3 text-cyan-400/30 group-hover:text-cyan-400/60 shrink-0 transition-colors" />
                  <span className="text-foreground/60 truncate group-hover:text-foreground/80 transition-colors">{keyBasename(obj.key)}</span>
                </div>
                <span className="text-[9px] text-muted-foreground/30 text-right">{keyPrefix(obj.key)}</span>
                <span className="text-[9px] text-muted-foreground/30 text-right tabular-nums">{formatBytes(obj.size)}</span>
                <span className="text-[9px] text-muted-foreground/30 text-right tabular-nums whitespace-nowrap">
                  {obj.lastModified ? new Date(obj.lastModified).toLocaleDateString() : "—"}
                </span>
              </motion.a>
            ))}
          </div>
          {cursor && (
            <button onClick={() => load(cursor, false)} disabled={loading}
              className="w-full py-3 text-[10px] font-mono text-muted-foreground/30 hover:text-muted-foreground/50 border border-border/10 hover:border-border/20 transition-all">
              {loading ? "loading…" : "load more"}
            </button>
          )}
        </motion.div>
      )}
    </SectionShell>
  );
}
