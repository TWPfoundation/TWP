"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Eye } from "lucide-react";

interface QueueEntry {
  id: string;
  tier1_score: number;
  tier1_reason: string;
  tier2_cap_tags: string[];
  tier2_rel_tags: string[];
  tier2_felt_tags: string[];
  tier2_specificity: number;
  tier2_counterfactual: number;
  tier2_relational: number;
  final_status: string;
  created_at: string;
  witness_profiles: { pseudonym: string }[] | null;
  testimony_records: { de_identified_text: string }[] | null;
}

export function AdminGateQueue({ entries }: { entries: QueueEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  const handleDecision = async (assessmentId: string, decision: "accept" | "reject") => {
    try {
      const res = await fetch("/api/admin/gate/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, decision }),
      });

      if (res.ok) {
        setDecisions((prev) => ({ ...prev, [assessmentId]: decision }));
      }
    } catch (err) {
      console.error("Review error:", err);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground/40 font-sans">
          No submissions in the review queue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => {
        const isExpanded = expandedId === entry.id;
        const decided = decisions[entry.id];
        const testimony = entry.testimony_records?.[0]?.de_identified_text;
        const pseudonym = entry.witness_profiles?.[0]?.pseudonym || "Unknown";
        const totalTags = (entry.tier2_cap_tags?.length || 0) + (entry.tier2_rel_tags?.length || 0) + (entry.tier2_felt_tags?.length || 0);

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className={`border p-6 space-y-4 ${
              decided === "accept" ? "border-emerald-800/30 opacity-60" :
              decided === "reject" ? "border-red-800/30 opacity-60" :
              "border-border/20"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-sm text-foreground/70">{pseudonym}</p>
                <p className="text-[10px] text-muted-foreground/30 font-sans">
                  {new Date(entry.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground/40">
                  Sieve: {entry.tier1_score}/100
                </span>
                <span className="text-xs font-mono text-muted-foreground/40">
                  Tags: {totalTags}
                </span>
                <span className="text-xs font-mono text-muted-foreground/40">
                  Spec: {entry.tier2_specificity}/10
                </span>
              </div>
            </div>

            {/* Tag display */}
            <div className="flex flex-wrap gap-1">
              {entry.tier2_cap_tags?.map((tag) => (
                <span key={tag} className="text-[9px] px-2 py-0.5 bg-blue-900/20 text-blue-300/60 font-mono">
                  CAP:{tag}
                </span>
              ))}
              {entry.tier2_rel_tags?.map((tag) => (
                <span key={tag} className="text-[9px] px-2 py-0.5 bg-purple-900/20 text-purple-300/60 font-mono">
                  REL:{tag}
                </span>
              ))}
              {entry.tier2_felt_tags?.map((tag) => (
                <span key={tag} className="text-[9px] px-2 py-0.5 bg-amber-900/20 text-amber-300/60 font-mono">
                  FELT:{tag}
                </span>
              ))}
            </div>

            {/* Expand/Collapse testimony */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className="flex items-center space-x-2 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-serif uppercase tracking-widest"
            >
              <Eye className="w-3 h-3" />
              <span>{isExpanded ? "Hide" : "Read"} De-identified Testimony</span>
            </button>

            {isExpanded && testimony && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="border-t border-border/10 pt-4 mt-4"
              >
                <p className="text-sm text-muted-foreground/60 font-sans leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar">
                  {testimony}
                </p>
              </motion.div>
            )}

            {/* Decision buttons */}
            {!decided && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDecision(entry.id, "accept")}
                  className="flex items-center space-x-2 px-4 py-2 border border-emerald-800/30 hover:border-emerald-500/50 text-emerald-500/70 hover:text-emerald-400 transition-colors text-xs font-serif uppercase tracking-widest"
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => handleDecision(entry.id, "reject")}
                  className="flex items-center space-x-2 px-4 py-2 border border-red-800/30 hover:border-red-500/50 text-red-500/70 hover:text-red-400 transition-colors text-xs font-serif uppercase tracking-widest"
                >
                  <XCircle className="w-3 h-3" />
                  <span>Reject</span>
                </button>
              </div>
            )}

            {decided && (
              <p className={`text-xs font-mono ${
                decided === "accept" ? "text-emerald-500/50" : "text-red-500/50"
              }`}>
                {decided.toUpperCase()}ED
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
