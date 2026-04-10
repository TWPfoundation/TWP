"use client";

import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "success">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep("otp");
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep("success");
      // Redirect after a brief moment
      setTimeout(() => {
        window.location.href = "/gate";
      }, 1500);
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
            The Gate requires identity. Enter your email to receive a one-time
            verification code. No password is stored.
          </p>
        </div>

        {step === "email" && (
          <motion.form
            key="email-step"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSendOTP}
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
                {isLoading ? "Sending..." : "Send Verification Code"}
              </span>
              <span className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
            </button>
          </motion.form>
        )}

        {step === "otp" && (
          <motion.form
            key="otp-step"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleVerifyOTP}
            className="space-y-6"
          >
            <p className="text-sm text-muted-foreground/60 font-sans">
              A 6-digit code has been sent to <strong className="text-foreground/80">{email}</strong>.
              Enter it below.
            </p>

            <div className="relative group">
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-transparent border-b border-border text-center py-4 px-6 text-foreground font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-foreground transition-colors duration-500 placeholder:text-muted-foreground/20"
                required
              />
              <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-foreground transition-all duration-700 ease-out group-focus-within:w-full" />
            </div>

            {error && (
              <p className="text-xs text-foreground/60 font-sans">{error}</p>
            )}

            <button
              id="verify-otp"
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="group/btn relative flex items-center justify-center space-x-3 py-3 px-8 mx-auto overflow-hidden border border-border/50 hover:border-foreground/40 transition-colors duration-500 disabled:opacity-40"
            >
              <span className="font-serif tracking-[0.2em] uppercase text-sm opacity-80 group-hover/btn:opacity-100">
                {isLoading ? "Verifying..." : "Verify Code"}
              </span>
              <ArrowRight className="w-4 h-4 opacity-50" />
              <span className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(null); }}
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-sans tracking-widest"
            >
              Use a different email
            </button>
          </motion.form>
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
