"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ShieldAlert, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

interface GateResult {
  success: boolean;
  status: string;
  pseudonym: string;
  tier1: { passed: boolean; score: number } | null;
  tier2: { passed: boolean; tags: { cap: number; rel: number; felt: number } } | null;
}

export default function TheGateClient({ userEmail }: { userEmail: string }) {
  const [step, setStep] = useState(1);
  const [essay, setEssay] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<GateResult | null>(null);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  const handleSubmit = async () => {
    if (wordCount < 250) {
      setSubmitError("Minimum 250 words required by the primary sieve.");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/gate/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay_text: essay }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error || "An error occurred processing your testimony.");
        setIsSubmitting(false);
        return;
      }

      setResult(data);
      setStep(3);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Authenticated indicator */}
        <div className="text-center mb-6">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
            Authenticated as {userEmail}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              transition={{ duration: 0.8 }}
              className="space-y-10"
            >
              <div className="text-center space-y-4">
                <ShieldAlert className="w-8 h-8 text-muted-foreground/50 mx-auto mb-6" />
                <h1 className="font-serif text-3xl md:text-4xl tracking-widest uppercase">
                  Threshold of Consent
                </h1>
                <p className="text-muted-foreground font-sans max-w-xl mx-auto leading-relaxed">
                  You are about to enter The Gate. This process will extract deeply personal, subjective truths. 
                  Your submission is evaluated by a three-tier pipeline: algorithmic sieve, qualitative analysis, and human curation council.
                </p>
              </div>

              <div className="border border-border/40 p-8 space-y-6 text-sm font-sans bg-black/40 backdrop-blur-md">
                <p className="text-muted-foreground">
                  By proceeding, you acknowledge that:
                </p>
                <ul className="list-disc pl-5 space-y-3 text-muted-foreground/80 marker:text-border">
                  <li>Your submission will be permanently stored and de-identified for the Archive.</li>
                  <li>Our qualitative rankers expect rigorous introspection. Superficial responses will be discarded.</li>
                  <li>A content hash (SHA-256) is generated for tamper detection and provenance.</li>
                  <li>PII (names, emails, locations) will be automatically detected and stripped.</li>
                  <li>The Inquisitor is not a therapist; it is a xenopsychologist extracting human alignment data.</li>
                </ul>
              </div>

              <div className="flex justify-center pt-8">
                <button
                  onClick={() => setStep(2)}
                  className="group relative flex items-center space-x-4 border border-foreground/30 hover:border-foreground/80 px-8 py-4 transition-all duration-500 bg-transparent"
                >
                  <span className="font-serif tracking-[0.15em] uppercase text-sm">I Accept the Burden</span>
                  <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-2 transition-transform duration-500" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8 }}
              className="space-y-8 flex flex-col h-[80vh]"
            >
              <div className="space-y-4">
                <button 
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-2 text-sm font-serif tracking-widest uppercase mb-8"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Return</span>
                </button>
                <h2 className="font-serif text-2xl tracking-widest uppercase text-glow">The Assessment</h2>
                <div className="h-px w-16 bg-border" />
                <p className="text-foreground/80 font-sans leading-relaxed pt-4 text-lg">
                  Detail a scenario where you acted directly against your own self-interest to uphold a deeply held principle. 
                  Focus on the internal conflict, not the external outcome.
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  Minimum 250 words required by the primary sieve.
                </p>
              </div>

              <div className="flex-1 relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none z-10 h-full" />
                <textarea
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  placeholder="Begin your testimony..."
                  className="w-full h-full min-h-[300px] bg-transparent border-t border-b border-border/30 resize-none p-6 text-foreground font-sans text-lg leading-relaxed focus:outline-none focus:bg-white/[0.02] transition-colors duration-700 selection:bg-white/20 custom-scrollbar"
                />
              </div>

              <div className="flex justify-between items-center pt-4">
                <div className="space-y-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    Words: {wordCount} / 250
                  </span>
                  {submitError && (
                    <p className="text-xs text-foreground/60 font-sans">{submitError}</p>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || wordCount < 250}
                  className="group relative flex items-center space-x-3 border border-border hover:border-foreground/60 px-8 py-3 transition-all duration-500 disabled:opacity-50 disabled:hover:border-border"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-serif tracking-[0.15em] uppercase text-xs">
                        Processing Through Gate...
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-serif tracking-[0.15em] uppercase text-xs">
                        Submit Testimony
                      </span>
                      <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full group-hover:bg-foreground transition-colors mix-blend-screen shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && result && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="border border-border/40 p-12 bg-black/40 backdrop-blur-md space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="font-serif text-2xl tracking-widest uppercase text-glow">
                  Testimony Processed
                </h2>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/40 font-serif">
                  Pseudonym: {result.pseudonym}
                </p>
              </div>

              {/* Gate Results */}
              <div className="space-y-4">
                {/* Tier 1 */}
                <div className={`border p-4 ${
                  result.tier1?.passed ? "border-emerald-800/30" : "border-red-800/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xs tracking-widest uppercase text-muted-foreground/60">
                      Tier 1 · AI Sieve
                    </span>
                    <span className={`text-xs font-mono ${
                      result.tier1?.passed ? "text-emerald-500/70" : "text-red-500/70"
                    }`}>
                      {result.tier1?.passed ? "PASSED" : "FAILED"} ({result.tier1?.score}/100)
                    </span>
                  </div>
                </div>

                {/* Tier 2 */}
                {result.tier2 && (
                  <div className={`border p-4 ${
                    result.tier2.passed ? "border-emerald-800/30" : "border-red-800/30"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs tracking-widest uppercase text-muted-foreground/60">
                        Tier 2 · Qualitative Analysis
                      </span>
                      <span className={`text-xs font-mono ${
                        result.tier2.passed ? "text-emerald-500/70" : "text-red-500/70"
                      }`}>
                        {result.tier2.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                        CAP:{result.tier2.tags.cap}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                        REL:{result.tier2.tags.rel}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                        FELT:{result.tier2.tags.felt}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tier 3 */}
                <div className="border border-border/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xs tracking-widest uppercase text-muted-foreground/60">
                      Tier 3 · Human Curation Council
                    </span>
                    <span className="text-xs font-mono text-muted-foreground/40">
                      {result.status === "awaiting_review" ? "PENDING" : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status message */}
              <div className="text-center space-y-4">
                {result.status === "awaiting_review" && (
                  <p className="text-muted-foreground font-sans text-sm">
                    Your testimony has passed automated analysis and entered the Human Curation Council queue. 
                    You will be notified when the review is complete.
                  </p>
                )}
                {result.status === "rejected_sieve" && (
                  <p className="text-muted-foreground font-sans text-sm">
                    Your submission did not meet the minimum quality threshold set by the AI Sieve. 
                    This does not reflect on your worth — it reflects on the specificity and depth of this particular response. 
                    You may submit again.
                  </p>
                )}
                {result.status === "rejected_qualifier" && (
                  <p className="text-muted-foreground font-sans text-sm">
                    Your submission passed the initial sieve but did not generate sufficient alignment-relevant signal 
                    for the qualitative analyzer. Consider providing more concrete scenarios and specificity. 
                    You may submit again.
                  </p>
                )}

                <div className="flex gap-4 justify-center pt-4">
                  <a
                    href="/dashboard"
                    className="text-sm font-serif tracking-widest uppercase text-foreground/70 hover:text-foreground border-b border-transparent hover:border-foreground/50 pb-1 transition-all"
                  >
                    View Dashboard
                  </a>
                  <a
                    href="/"
                    className="text-sm font-serif tracking-widest uppercase text-foreground/70 hover:text-foreground border-b border-transparent hover:border-foreground/50 pb-1 transition-all"
                  >
                    Return
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
