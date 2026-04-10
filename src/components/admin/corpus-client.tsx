"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Tag, Eye, EyeOff, Save, ChevronDown, ChevronUp } from "lucide-react";

// Known taxonomy — extend as the corpus grows
const CAP_OPTIONS = [
  "transparency_mandate", "accountability_demand", "deception_prohibition",
  "power_constraint", "consent_requirement", "autonomy_preservation",
  "harm_prevention", "truth_telling", "fairness_demand",
];
const REL_OPTIONS = [
  "trust_erosion", "betrayal_recognition", "obligation_to_future",
  "community_obligation", "reciprocity", "care_dependency",
  "solidarity_claim", "vulnerability_exposure",
];
const FELT_OPTIONS = [
  "moral_vertigo", "cognitive_dissonance", "moral_injury",
  "resolve_under_pressure", "complicity_awareness", "grief",
  "shame", "indignation", "empathic_distress", "relief",
];

interface Assessment {
  tier1_score: number;
  tier2_cap_tags: string[];
  tier2_rel_tags: string[];
  tier2_felt_tags: string[];
  tier2_specificity: number;
  tier2_counterfactual: number;
  tier2_relational: number;
  final_status: string;
}

interface TestimonyEntry {
  id: string;
  de_identified_text: string;
  status: string;
  annotations: Record<string, unknown> | null;
  created_at: string;
  gate_assessments: Assessment | Assessment[] | null;
}

function TagPill({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] px-2 py-0.5 font-mono border transition-all duration-200 ${
        active
          ? `${color} border-current`
          : "text-muted-foreground/20 border-border/10 hover:text-muted-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}

function AnnotationPanel({ testimony, onSave }: { testimony: TestimonyEntry; onSave: (id: string, data: Record<string, unknown>) => void }) {
  const assessment: Assessment | null = Array.isArray(testimony.gate_assessments)
    ? testimony.gate_assessments[0]
    : testimony.gate_assessments;

  const existing = testimony.annotations || {};

  const [capTags, setCapTags] = useState<string[]>(
    (existing.cap_tags as string[]) || assessment?.tier2_cap_tags || []
  );
  const [relTags, setRelTags] = useState<string[]>(
    (existing.rel_tags as string[]) || assessment?.tier2_rel_tags || []
  );
  const [feltTags, setFeltTags] = useState<string[]>(
    (existing.felt_tags as string[]) || assessment?.tier2_felt_tags || []
  );
  const [notes, setNotes] = useState<string>((existing.hcc_notes as string) || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const toggleTag = (tag: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    const data = {
      cap_tags: capTags,
      rel_tags: relTags,
      felt_tags: feltTags,
      hcc_notes: notes,
      annotated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/admin/corpus/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonyId: testimony.id, annotations: data }),
      });

      if (res.ok) {
        setSaveMessage("Annotations saved");
        onSave(testimony.id, data);
      } else {
        setSaveMessage("Error saving");
      }
    } catch {
      setSaveMessage("Error saving");
    }
    setIsSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-border/5 mt-4 pt-4 space-y-5"
    >
      {/* De-identified testimony */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest">
          De-identified Testimony
        </p>
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
          <p className="text-sm text-muted-foreground/60 font-sans leading-relaxed whitespace-pre-wrap">
            {testimony.de_identified_text || "No de-identified text available."}
          </p>
        </div>
      </div>

      {/* AI Scores */}
      {assessment && (
        <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/40">
          <span>Sieve: {assessment.tier1_score}/100</span>
          <span>Spec: {assessment.tier2_specificity ?? "–"}/10</span>
          <span>Counter: {assessment.tier2_counterfactual ?? "–"}/10</span>
          <span>Relational: {assessment.tier2_relational ?? "–"}/10</span>
        </div>
      )}

      {/* CAP Tags */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-blue-400/50 uppercase tracking-widest">CAP Tags</p>
        <div className="flex flex-wrap gap-1">
          {CAP_OPTIONS.map(tag => (
            <TagPill
              key={tag}
              label={tag}
              active={capTags.includes(tag)}
              color="text-blue-400/70"
              onClick={() => toggleTag(tag, capTags, setCapTags)}
            />
          ))}
        </div>
      </div>

      {/* REL Tags */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-purple-400/50 uppercase tracking-widest">REL Tags</p>
        <div className="flex flex-wrap gap-1">
          {REL_OPTIONS.map(tag => (
            <TagPill
              key={tag}
              label={tag}
              active={relTags.includes(tag)}
              color="text-purple-400/70"
              onClick={() => toggleTag(tag, relTags, setRelTags)}
            />
          ))}
        </div>
      </div>

      {/* FELT Tags */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-amber-400/50 uppercase tracking-widest">FELT Tags</p>
        <div className="flex flex-wrap gap-1">
          {FELT_OPTIONS.map(tag => (
            <TagPill
              key={tag}
              label={tag}
              active={feltTags.includes(tag)}
              color="text-amber-400/70"
              onClick={() => toggleTag(tag, feltTags, setFeltTags)}
            />
          ))}
        </div>
      </div>

      {/* HCC Notes */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest">HCC Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add qualitative notes, thematic observations, etc."
          className="w-full bg-transparent border border-border/10 p-3 text-sm font-sans text-muted-foreground/60 placeholder:text-muted-foreground/20 focus:outline-none focus:border-border/30 transition-colors resize-y min-h-[80px]"
        />
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 border border-border/20 hover:border-foreground/30 text-xs font-serif uppercase tracking-widest text-foreground/60 hover:text-foreground transition-all"
        >
          <Save className="w-3 h-3" />
          {isSaving ? "Saving..." : "Save Annotations"}
        </button>
        {saveMessage && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-[10px] font-mono ${
              saveMessage.includes("Error") ? "text-red-400/60" : "text-emerald-400/60"
            }`}
          >
            {saveMessage}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

export function CorpusClient({ testimonies }: { testimonies: TestimonyEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="pt-24 pb-16 px-8 space-y-10 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground/40" />
          <h1 className="text-2xl font-light tracking-widest text-foreground text-glow uppercase">
            Corpus Manager
          </h1>
        </div>
        <p className="text-xs text-muted-foreground/40 font-mono tracking-wide">
          {testimonies.length} testimon{testimonies.length === 1 ? "y" : "ies"} in corpus · Manual annotation & tagging interface
        </p>
      </motion.div>

      {/* Testimony list */}
      {testimonies.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground/30 font-sans">
            No testimonies in the corpus yet. Accept submissions from the Gate Queue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {testimonies.map((t, i) => {
            const isExpanded = expandedId === t.id;
            const assessment: Assessment | null = Array.isArray(t.gate_assessments)
              ? t.gate_assessments[0]
              : t.gate_assessments;
            const totalTags = (assessment?.tier2_cap_tags?.length || 0) +
              (assessment?.tier2_rel_tags?.length || 0) +
              (assessment?.tier2_felt_tags?.length || 0);
            const hasAnnotations = t.annotations && Object.keys(t.annotations).length > 0;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className="border border-border/10 bg-white/[0.01] p-5"
              >
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 font-mono uppercase tracking-wider ${
                        t.status === "annotating" ? "text-amber-400/60 bg-amber-900/10" :
                        t.status === "annotated" ? "text-emerald-400/60 bg-emerald-900/10" :
                        "text-muted-foreground/30 bg-white/5"
                      }`}>
                        {t.status}
                      </span>
                      {hasAnnotations && (
                        <Tag className="w-3 h-3 text-emerald-500/40" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/30 font-mono">
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric"
                      })}
                      {" · "}
                      {totalTags} AI tags · Sieve {assessment?.tier1_score ?? "–"}/100
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/20 font-mono">
                      {t.de_identified_text?.slice(0, 60)}...
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground/20" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground/20" />
                    )}
                  </div>
                </button>

                {/* Expanded panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <AnnotationPanel
                      testimony={t}
                      onSave={(id, data) => {
                        // Optimistic update
                      }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
