"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Password updated. Redirecting to admin login…");
    setTimeout(() => router.push("/admin/login"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
      <div className="w-full max-w-md px-8 py-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Set new password</h1>
          <p className="mt-1 text-sm text-white/40">Admin account — Operator Studio</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 focus:bg-white/8 transition-all"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 focus:bg-white/8 transition-all"
            />
          </div>

          {message && (
            <p className={`text-sm px-3 py-2 rounded-lg ${
              status === "error"
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            }`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-colors"
          >
            {status === "loading" ? "Updating…" : status === "success" ? "Done ✓" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
