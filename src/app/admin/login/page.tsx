"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Shield } from "lucide-react";
import { loginAdmin } from "./actions";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [passphrase, setPassphrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("passphrase", passphrase);

    const result = await loginAdmin(formData);

    if (result.success) {
      // Authenticated — go straight to admin queue
      router.push("/admin/gate");
      router.refresh();
    } else {
      setError(result.error || "Unknown error occurred.");
      setIsLoading(false);
      setPassphrase("");
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-white/20">
      {/* Background glow unique to admin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-sm mx-auto text-center space-y-8 z-10"
      >
        <div className="space-y-4">
          <Shield className="w-8 h-8 mx-auto text-red-500/50" />
          <h1 className="text-2xl font-serif tracking-widest text-foreground text-glow uppercase">
            God Mode
          </h1>
          <p className="text-xs tracking-[0.2em] text-muted-foreground/40 font-mono uppercase">
            Restricted Authenticator
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative group">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              className="w-full bg-transparent border-b border-border/50 text-center py-4 px-6 text-foreground font-sans text-xl focus:outline-none focus:border-red-500/50 transition-colors duration-500 placeholder:text-muted-foreground/20"
              required
            />
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-red-500/70 transition-all duration-700 ease-out group-focus-within:w-full" />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400/80 font-mono tracking-wide"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="group/btn relative w-full flex items-center justify-center space-x-3 py-4 overflow-hidden border border-border/30 hover:border-red-500/40 transition-colors duration-500"
          >
            <span className="font-serif tracking-[0.2em] uppercase text-xs opacity-70 group-hover/btn:opacity-100">
              {isLoading ? "Verifying..." : "Breach Gate"}
            </span>
            <span className="absolute inset-0 bg-red-500/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
          </button>
        </form>
      </motion.div>
    </main>
  );
}
