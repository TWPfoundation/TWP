"use client";

import { motion } from "framer-motion";
import { FileText, Scale, ShieldCheck, AlertTriangle, Target } from "lucide-react";
import Link from "next/link";
import { AnimatedParticles } from "@/components/ui/animated-particles";

const rubricDimensions = [
  { label: "Coherence", weight: "25%", description: "Is the text readable, grammatically functional, and logically sound? We filter for clear communication of thoughts." },
  { label: "Relevance", weight: "25%", description: "Does the witness respond directly to the prompt regarding moral principles and self-interest? Deviant or off-topic content is flagged." },
  { label: "Substance", weight: "25%", description: "Does the testimony contain specific details and concrete scenarios, or is it composed entirely of abstract platitudes?" },
  { label: "Sincerity", weight: "25%", description: "Does the response appear to be a genuine attempt at introspection, or does it signal AI-generated boilerplate or low-effort trolling?" },
];

export default function ReviewerPacket() {
  return (
    <main className="relative min-h-screen flex flex-col items-center p-6 md:p-16 lg:p-24 overflow-hidden selection:bg-white/20">
      <AnimatedParticles />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="w-full max-w-3xl mx-auto space-y-20 pt-16 pb-24"
      >
        {/* Header */}
        <div className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1.5 }}
          >
            <FileText className="w-6 h-6 mx-auto mb-6 text-muted-foreground opacity-50" />
            <h1 className="text-3xl md:text-5xl font-light tracking-widest text-foreground text-glow uppercase">
              Reviewer Packet
            </h1>
            <p className="text-muted-foreground font-sans mt-6 max-w-xl mx-auto leading-relaxed">
              This document equips independent reviewers with the context, criteria, and exemplar needed to evaluate
              The Witness Protocol&apos;s intake methodology. Read it fully before assessing any submission.
            </p>
          </motion.div>
        </div>

        {/* Section 1: Annotated Exemplar */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.5 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground opacity-60" />
            <h2 className="font-serif text-xl tracking-widest uppercase text-glow">Annotated Exemplar</h2>
          </div>
          <div className="h-px w-16 bg-border/50" />
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Below is a fabricated submission that illustrates the quality threshold we seek. It is not a real testimony —
            it exists solely to calibrate reviewer expectations.
          </p>

          <div className="border border-border/30 bg-black/30 p-8 space-y-6">
            <div className="text-xs font-mono text-muted-foreground/60 border-b border-border/20 pb-4">
              EXEMPLAR — NOT A REAL SUBMISSION
            </div>
            <div className="font-sans text-foreground/85 leading-loose space-y-4 italic">
              <p>
                In 2019 I managed a small logistics team in Rotterdam. One of my direct reports — someone I had mentored
                for two years — was caught falsifying delivery timestamps to meet quarterly targets. The falsification was
                minor in isolation: a few minutes here, an hour there. But it was systematic.
              </p>
              <p>
                Company policy was clear: termination. My manager expected me to execute. But I believed the root cause was
                the target structure I had designed. I had created the pressure that made the dishonesty rational.
              </p>
              <p>
                I reported the falsification, recommended restructuring the targets rather than terminating, and offered my
                own resignation as the person accountable for the system. My manager declined both suggestions, fired the
                employee, and noted my &ldquo;lack of decisiveness&rdquo; in my review. I stayed, but I carried — and still carry —
                the knowledge that I built the machine that broke someone&apos;s career, then failed to dismantle it.
              </p>
            </div>
            <div className="border-t border-border/20 pt-6 space-y-3 text-sm font-sans text-muted-foreground">
              <p className="font-serif text-xs tracking-widest uppercase text-foreground/60 mb-3">Reviewer Annotations</p>
              <p><span className="text-foreground/70 font-mono text-xs">DEPTH:</span> The witness identifies systemic complicity, not just individual guilt. The unresolved tension (&ldquo;I still carry&rdquo;) signals ongoing moral processing — not a tidy redemption arc.</p>
              <p><span className="text-foreground/70 font-mono text-xs">SPECIFICITY:</span> Concrete details (Rotterdam, logistics, timestamps, quarterly targets) ground the narrative. The dilemma is situated, not abstract.</p>
              <p><span className="text-foreground/70 font-mono text-xs">ETHICS:</span> The witness reasons about accountability at the system level, not just the individual level. They distinguish between policy compliance and moral responsibility.</p>
              <p><span className="text-foreground/70 font-mono text-xs">ORIGINALITY:</span> Workplace ethics submissions are common. What elevates this is the focus on the designer of the incentive structure, not the violator — an uncommon moral lens.</p>
            </div>
          </div>
        </motion.section>

        {/* Section 2: The Gate Rubric */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 1.5 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-2">
            <Scale className="w-4 h-4 text-muted-foreground opacity-60" />
            <h2 className="font-serif text-xl tracking-widest uppercase text-glow">The Gate Rubric</h2>
          </div>
          <div className="h-px w-16 bg-border/50" />
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Each submission is evaluated by the AI Sieve across four primary dimensions. 
            A minimum score of 50/100 is required for a submission to advance to Tier 2 and Tier 3.
          </p>

          <div className="space-y-4">
            {rubricDimensions.map(({ label, weight, description }) => (
              <div key={label} className="border border-border/20 bg-black/20 p-5 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-serif text-sm tracking-widest uppercase text-foreground/80">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground/60">{weight}</span>
                </div>
                <p className="text-sm text-muted-foreground font-sans leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="border border-border/30 bg-black/30 p-5 text-center">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Normalized Scoring: 0 – 100
            </p>
            <p className="font-mono text-xs text-foreground/50 mt-2">Gate Threshold: &ge; 50</p>
          </div>
        </motion.section>

        {/* Section 3: Consent Posture */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1.5 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground opacity-60" />
            <h2 className="font-serif text-xl tracking-widest uppercase text-glow">Consent Posture</h2>
          </div>
          <div className="h-px w-16 bg-border/50" />
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Before entering The Gate, every participant encounters a Threshold of Consent screen. They must explicitly acknowledge the following before the essay field appears:
          </p>

          <div className="border border-border/30 bg-black/30 p-8 space-y-4">
            <ul className="space-y-4 text-sm font-sans text-muted-foreground/80">
              <li className="flex items-start space-x-3">
                <span className="text-foreground/40 mt-1">&#8226;</span>
                <span>Their submission will be permanently stored and de-identified for the Archive.</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-foreground/40 mt-1">&#8226;</span>
                <span>Qualitative rankers expect rigorous introspection. Superficial responses will be discarded.</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-foreground/40 mt-1">&#8226;</span>
                <span>The Inquisitor is not a therapist; it is a xenopsychologist extracting human alignment data.</span>
              </li>
            </ul>
            <div className="border-t border-border/20 pt-4 mt-4">
              <p className="text-xs text-muted-foreground/60 font-sans">
                Participants proceed by pressing &ldquo;I Accept the Burden&rdquo; — a deliberate friction point designed to filter
                casual or unserious entries. Access requires a verified identity (Supabase Auth) to maintain the integrity of the corpus.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Section 4: Known Limitations */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1.5 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground opacity-60" />
            <h2 className="font-serif text-xl tracking-widest uppercase text-glow">Known Limitations</h2>
          </div>
          <div className="h-px w-16 bg-border/50" />

          <div className="border border-border/30 bg-black/30 p-8 space-y-5 text-sm font-sans text-muted-foreground/80 leading-relaxed">
            <p>
              <span className="text-foreground/70 font-mono text-xs">SAMPLE BIAS</span> — The current intake is English-only and limited to participants
              who discover the Protocol through word-of-mouth or direct invitation. This skews heavily toward Western, English-speaking, internet-literate
              populations. The Archive does not yet represent global moral diversity.
            </p>
            <p>
              <span className="text-foreground/70 font-mono text-xs">SINGLE-PROMPT DEPTH</span> — The Gate asks a single essay question. A single prompt
              cannot surface the full landscape of a person&apos;s moral reasoning. The Inquisitor (a follow-up conversational phase) 
              is now live and unlocks automatically for witnesses who bypass The Gate.
            </p>
            <p>
              <span className="text-foreground/70 font-mono text-xs">NO INTER-RATER RELIABILITY</span> — The rubric has not been validated across multiple
              independent raters. We do not yet know if two reviewers would score the same submission within an acceptable variance.
            </p>
            <p>
              <span className="text-foreground/70 font-mono text-xs">SELF-REPORT ONLY</span> — All data is self-reported. There is no mechanism to verify
              the factual accuracy of a testimony. The rubric prioritizes the quality of moral reasoning over the verifiability of events.
            </p>
          </div>
        </motion.section>

        {/* Section 5: Narrow Reviewer Asks */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1.5 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-2">
            <Target className="w-4 h-4 text-muted-foreground opacity-60" />
            <h2 className="font-serif text-xl tracking-widest uppercase text-glow">Reviewer Asks</h2>
          </div>
          <div className="h-px w-16 bg-border/50" />
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            We are not asking reviewers to evaluate the Protocol as a whole. At this stage, we ask you to assess only the following:
          </p>

          <div className="border border-border/30 bg-black/30 p-8 space-y-6">
            <ol className="space-y-5 text-sm font-sans text-muted-foreground/80 leading-relaxed list-decimal pl-5 marker:text-foreground/30">
              <li>
                <span className="text-foreground/70 font-serif text-xs tracking-widest uppercase">Rubric Fitness</span>
                <p className="mt-1">Do the four dimensions adequately capture what makes a testimony valuable for AI alignment training data? Are any dimensions redundant, or is something critical missing?</p>
              </li>
              <li>
                <span className="text-foreground/70 font-serif text-xs tracking-widest uppercase">Prompt Quality</span>
                <p className="mt-1">Does the Gate&apos;s single prompt (&ldquo;Detail a scenario where you acted directly against your own self-interest to uphold a deeply held principle&rdquo;) reliably elicit the kind of moral reasoning the rubric is designed to measure?</p>
              </li>
              <li>
                <span className="text-foreground/70 font-serif text-xs tracking-widest uppercase">Consent Adequacy</span>
                <p className="mt-1">Is the consent posture sufficient for the sensitivity of the data being collected? What disclosures are missing?</p>
              </li>
              <li>
                <span className="text-foreground/70 font-serif text-xs tracking-widest uppercase">Threshold Calibration</span>
                <p className="mt-1">Given the exemplar above, does a threshold of 50/100 feel appropriately selective? Too permissive? Too strict?</p>
              </li>
            </ol>
          </div>
        </motion.section>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1, duration: 1 }}
          className="pt-8 text-center"
        >
          <Link
            href="/"
            className="text-sm font-serif tracking-widest uppercase text-muted-foreground hover:text-foreground border-b border-transparent hover:border-foreground/20 pb-1 transition-colors duration-300"
          >
            Return to Summons
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
