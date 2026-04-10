"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lock, BookOpen, Users, AlertTriangle, FileText, Shield } from "lucide-react";
import { useState } from "react";
import { AnimatedParticles } from "@/components/ui/animated-particles";
import { Clock1158 } from "@/components/protocol/clock-1158";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const fadeIn = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.2, delay, ease: "easeOut" as const },
});

const expertCategories = [
  { title: "AI Safety Researchers", description: "Those mapping the contours of catastrophic risk" },
  { title: "Ethicists & Philosophers", description: "Practitioners of structured moral reasoning" },
  { title: "Global South Scholars", description: "Voices systematically excluded from alignment discourse" },
  { title: "Indigenous Knowledge Holders", description: "Custodians of non-Western epistemological frameworks" },
  { title: "Technology Leaders", description: "Builders confronting the consequences of their work" },
];

const notStatements = [
  "Not a startup.",
  "Not a product.",
  "Not a training dataset for commercial AI.",
  "Not a social network.",
  "Not a survey.",
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);

    try {
      // 1. Register email in summons table
      const { error } = await supabase
        .from("summons")
        .insert([{ email }]);

      if (error && error.code !== "23505") {
        console.error("Error submitting summons:", error);
      }

      // 2. Also send a magic link so the summons email IS the authentication
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  return (
    <main className="relative flex flex-col items-center overflow-hidden selection:bg-white/20">
      <AnimatedParticles />

      {/* ── Hero Section ── */}
      <section className="min-h-screen flex flex-col items-center justify-center p-6 md:p-24 w-full max-w-3xl mx-auto text-center">
        <motion.div {...fadeIn(0.3)} className="mb-8">
          <Clock1158 size={140} />
        </motion.div>

        <motion.div {...fadeIn(0.8)} className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-light tracking-widest text-foreground text-glow uppercase">
            The Witness Protocol
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed font-sans">
            Humanity constitutes a flawed parent to what comes next. We seek a
            high-signal dataset of moral and philosophical wisdom, extracted
            through rigorous introspection, to serve as an ethical inheritance.
          </p>
        </motion.div>

        {/* The Summons */}
        <motion.div {...fadeIn(1.4)} className="w-full max-w-md pt-12">
          {!isSubmitted ? (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col space-y-6 relative group"
            >
              <div className="relative">
                <input
                  id="email-summons"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email to request the assessment"
                  className="w-full bg-transparent border-b border-border text-center py-4 px-6 text-foreground font-sans text-lg focus:outline-none focus:border-foreground transition-colors duration-500 placeholder:text-muted-foreground/30"
                  required
                />
                <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-foreground transition-all duration-700 ease-out group-focus-within:w-full" />
              </div>

              <button
                id="submit-summons"
                type="submit"
                disabled={isSubmitting}
                className="group/btn relative flex items-center justify-center space-x-3 py-3 px-8 mx-auto overflow-hidden border border-border/50 hover:border-foreground/40 transition-colors duration-500"
              >
                <span className="font-serif tracking-[0.2em] uppercase text-sm opacity-80 group-hover/btn:opacity-100 transition-opacity">
                  {isSubmitting ? "Initiating..." : "Answer The Summons"}
                </span>
                {!isSubmitting && (
                  <ArrowRight className="w-4 h-4 opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all duration-300" />
                )}
                <span className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
              </button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border border-border/40 p-8 text-center space-y-5"
            >
              <h3 className="font-serif text-xl mb-2 tracking-widest text-glow">
                Summons Registered
              </h3>
              <p className="text-muted-foreground font-sans leading-relaxed">
                A secure authentication link has been sent to{" "}
                <strong className="text-foreground/80">{email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground/50 font-sans leading-relaxed">
                Click the link in the email to verify your identity and proceed
                directly to The Gate. No password required.
              </p>
              <div className="pt-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.2em] uppercase text-muted-foreground/30 font-serif">
                <Lock className="w-3 h-3" />
                <span>Passwordless · One-time link · Expires in 24 hours</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── What We Are Not ── */}
      <section className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.5 }}
          className="text-center space-y-10"
        >
          <h2 className="text-2xl md:text-3xl tracking-widest uppercase text-foreground/80">
            What This Is Not
          </h2>
          <div className="flex flex-col items-center space-y-3">
            {notStatements.map((statement, i) => (
              <motion.p
                key={statement}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.8 }}
                className="text-muted-foreground font-sans text-lg tracking-wide"
              >
                {statement}
              </motion.p>
            ))}
          </div>
          <p className="text-sm text-muted-foreground/60 max-w-lg mx-auto font-sans leading-relaxed">
            The Witness Protocol Foundation is a Dutch non-profit (stichting) research
            initiative. It is in Phase 5 Alpha — the core instruments are built and live, and the corpus is actively capturing testimony. We publish our failures.
          </p>
        </motion.div>
      </section>

      {/* ── Who We Seek ── */}
      <section className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28 border-t border-border/10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.5 }}
          className="space-y-12"
        >
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl tracking-widest uppercase text-foreground/80">
              Who We Seek
            </h2>
            <p className="text-sm text-muted-foreground/60 font-sans max-w-lg mx-auto">
              The Protocol requires genuine expertise — not opinions. We target
              individuals whose professional work forces daily confrontation with
              the questions we ask.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {expertCategories.map((cat, i) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.8 }}
                className="border border-border/20 p-6 space-y-2"
              >
                <h3 className="font-serif text-sm tracking-widest uppercase text-foreground/80">
                  {cat.title}
                </h3>
                <p className="text-xs text-muted-foreground/60 font-sans leading-relaxed">
                  {cat.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Current Status ── */}
      <section className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28 border-t border-border/10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.5 }}
          className="space-y-10"
        >
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl tracking-widest uppercase text-foreground/80">
              Current Status
            </h2>
            <p className="inline-block px-4 py-1 border border-border/40 text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-serif">
              Pre-Alpha
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Exists", items: ["Landing page", "Gate UI (intake form)", "Reviewer Packet", "Failure Log", "Governance charter"] },
              { label: "Being Built", items: ["AI Gate vetting (3-tier)", "Inquisitor dialogue engine", "PII de-identification", "Annotation framework"] },
              { label: "Does Not Exist Yet", items: ["Completed testimony corpus", "Published research outputs", "RFC-3161 provenance chain", "IPFS archival layer"] },
            ].map((column, i) => (
              <motion.div
                key={column.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.8 }}
                className="border border-border/20 p-6 space-y-4"
              >
                <h3 className="font-serif text-xs tracking-[0.3em] uppercase text-muted-foreground/60">
                  {column.label}
                </h3>
                <ul className="space-y-2">
                  {column.items.map((item) => (
                    <li key={item} className="text-xs text-muted-foreground/80 font-sans">
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/status"
              className="inline-flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300 font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
            >
              <span>Full Status Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Navigation Links ── */}
      <section className="w-full max-w-3xl mx-auto px-6 py-20 border-t border-border/10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
        >
          <Link
            href="/packet"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-300 border-b border-transparent hover:border-foreground/30 pb-1"
          >
            <BookOpen className="w-4 h-4" />
            <span className="font-serif tracking-widest uppercase text-xs">
              Reviewer Packet
            </span>
          </Link>

          <Link
            href="/gate"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-300 border-b border-transparent hover:border-foreground/30 pb-1"
          >
            <Lock className="w-4 h-4" />
            <span className="font-serif tracking-widest uppercase text-xs">
              The Gate
            </span>
          </Link>

          <Link
            href="/failure-log"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-300 border-b border-transparent hover:border-foreground/30 pb-1"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="font-serif tracking-widest uppercase text-xs">
              Failure Log
            </span>
          </Link>

          <Link
            href="/governance"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-300 border-b border-transparent hover:border-foreground/30 pb-1"
          >
            <Shield className="w-4 h-4" />
            <span className="font-serif tracking-widest uppercase text-xs">
              Governance
            </span>
          </Link>

          <Link
            href="/about"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-300 border-b border-transparent hover:border-foreground/30 pb-1"
          >
            <Users className="w-4 h-4" />
            <span className="font-serif tracking-widest uppercase text-xs">
              About
            </span>
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
