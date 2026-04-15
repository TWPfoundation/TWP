"use client";

import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Lock, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent" | "success">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const searchParams = useSearchParams();

  // Check for verification error from callback
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (searchParams.get("error") === "verification_failed") {
      setError("Verification link expired or was already used. Please request a new one.");
    }
  }, [searchParams]);

  // Check if already authenticated → redirect
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setStep("success");
        setTimeout(() => {
          window.location.href = "/gate";
        }, 1200);
      }
    };
    checkAuth();
  }, [supabase.auth]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep("sent");
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-white/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" as const }}
        className="w-full max-w-md mx-auto text-center space-y-10"
      >
        <div className="space-y-4">
          <Lock className="w-6 h-6 mx-auto text-muted-foreground/50" />
          <h1 className="text-3xl md:text-4xl font-light tracking-widest text-foreground text-glow uppercase">
            Authenticate
          </h1>
          <p className="text-sm text-muted-foreground/60 font-sans max-w-sm mx-auto">
            The Gate requires identity. Enter your email to receive a
            secure login link. No password is stored.
          </p>
        </div>

        {step === "email" && (
          <motion.form
            key="email-step"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSendLink}
            className="space-y-6"
          >
            <div className="relative group">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-transparent border-b border-border text-center py-4 px-6 text-foreground font-sans text-lg focus:outline-none focus:border-foreground transition-colors duration-500 placeholder:text-muted-foreground/30"
                required
              />
              <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-foreground transition-all duration-700 ease-out group-focus-within:w-full" />
            </div>

            {error && (
              <p className="text-xs text-foreground/60 font-sans">{error}</p>
            )}

            <button
              id="submit-email"
              type="submit"
              disabled={isLoading}
              className="group/btn relative flex items-center justify-center space-x-3 py-3 px-8 mx-auto overflow-hidden border border-border/50 hover:border-foreground/40 transition-colors duration-500"
            >
              <Mail className="w-4 h-4 opacity-50" />
              <span className="font-serif tracking-[0.2em] uppercase text-sm opacity-80 group-hover/btn:opacity-100">
                {isLoading ? "Sending..." : "Send Login Link"}
              </span>
              <span className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
            </button>
          </motion.form>
        )}

        {step === "sent" && (
          <motion.div
            key="sent-step"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="border border-border/40 p-8 text-center space-y-5">
              <ExternalLink className="w-5 h-5 mx-auto text-muted-foreground/50" />
              <h3 className="font-serif text-xl tracking-widest text-glow">
                Check Your Inbox
              </h3>
              <p className="text-sm text-muted-foreground/60 font-sans">
                A secure login link has been sent to{" "}
                <strong className="text-foreground/80">{email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground/40 font-sans">
                Click the link in the email to authenticate and proceed directly to The Gate.
                The link expires after 24 hours.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/30 font-serif">
                Didn&apos;t receive it?
              </p>
              <button
                onClick={() => { setStep("email"); setError(null); }}
                className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-sans tracking-widest border-b border-transparent hover:border-muted-foreground/30 pb-px"
              >
                Try again with a different email
              </button>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success-step"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-border/40 p-8 text-center space-y-4"
          >
            <h3 className="font-serif text-xl tracking-widest text-glow">
              Identity Confirmed
            </h3>
            <p className="text-muted-foreground font-sans text-sm">
              Redirecting to The Gate...
            </p>
          </motion.div>
        )}

        {/* Footer */}
        <div className="pt-8">
          <Link
            href="/"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-serif tracking-widest uppercase"
          >
            Return to Landing
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
