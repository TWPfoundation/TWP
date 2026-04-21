"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Send,
  Zap,
  ChevronUp,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface Turn {
  id: string;
  role: "witness" | "inquisitor" | "system";
  content: string;
}

interface RuntimeSession {
  id: string;
  turns: Array<{
    id: string;
    userMessage: string;
    assistantMessage: string;
  }>;
}

interface Props {
  testimonyId: string;
  testimonyPreview: string;
}

type SessionStatus =
  | "loading"
  | "consent_required"
  | "ready"
  | "active"
  | "error";

function sessionToMessages(session: RuntimeSession | null): Turn[] {
  if (!session) {
    return [];
  }

  return session.turns.flatMap((turn) => [
    {
      id: `${turn.id}-w`,
      role: "witness" as const,
      content: turn.userMessage,
    },
    {
      id: `${turn.id}-i`,
      role: "inquisitor" as const,
      content: turn.assistantMessage,
    },
  ]);
}

export function InstrumentClient({ testimonyId, testimonyPreview }: Props) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGrantingConsent, setIsGrantingConsent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [bridgeStatus, setBridgeStatus] = useState("pending");
  const [consentStatus, setConsentStatus] = useState("unknown");
  const [roundCount, setRoundCount] = useState(0);
  const [showTestimony, setShowTestimony] = useState(false);
  const [missingScopes, setMissingScopes] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = useCallback(async () => {
    setSessionStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/inquisitor/session?testimonyId=${testimonyId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load governed witness runtime.");
      }

      setBridgeStatus(data.bridgeStatus || "pending");
      setConsentStatus(data.consentStatus || "unknown");
      setMissingScopes(Array.isArray(data.missingScopes) ? data.missingScopes : []);

      if (data.session) {
        setSessionId(data.session.id);
        setRoundCount(data.roundCount || data.session.turns.length || 0);
        setMessages(sessionToMessages(data.session));
        setSessionStatus("active");
        return;
      }

      setSessionId(null);
      setRoundCount(0);

      if (Array.isArray(data.missingScopes) && data.missingScopes.length > 0) {
        setMessages([
          {
            id: "consent-required",
            role: "system",
            content:
              "Governed Witness runtime consent is required before the session can begin.",
          },
        ]);
        setSessionStatus("consent_required");
        return;
      }

      setMessages([
        {
          id: "runtime-ready",
          role: "system",
          content:
            "Governed Witness runtime is ready. Your next message will be sent through G_5.2.",
        },
      ]);
      setSessionStatus("ready");
    } catch (error) {
      console.error("Witness runtime bootstrap error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Witness runtime bootstrap failed.";
      setMessages([
        {
          id: "runtime-error",
          role: "system",
          content: message,
        },
      ]);
      setErrorMessage(message);
      setSessionStatus("error");
    }
  }, [testimonyId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleGrantConsent = async () => {
    setIsGrantingConsent(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/inquisitor/consent", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to grant runtime consent.");
      }

      await loadSession();
    } catch (error) {
      console.error("Witness runtime consent error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to grant runtime consent."
      );
      setSessionStatus("error");
    } finally {
      setIsGrantingConsent(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || sessionStatus === "consent_required") {
      return;
    }

    const witnessMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/inquisitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          testimonyId: sessionId ? undefined : testimonyId,
          message: witnessMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.missingScopes) && data.missingScopes.length > 0) {
          setMissingScopes(data.missingScopes);
          setConsentStatus("missing_required");
          setSessionStatus("consent_required");
        }
        throw new Error(data.error || "Witness runtime turn failed.");
      }

      setSessionId(data.session.id);
      setRoundCount(data.roundCount || data.session.turns.length || 0);
      setMessages(sessionToMessages(data.session));
      setBridgeStatus("active");
      setConsentStatus("ready");
      setMissingScopes([]);
      setSessionStatus("active");
    } catch (error) {
      console.error("Witness runtime turn error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Witness runtime turn failed."
      );
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const statusLabel =
    sessionStatus === "loading"
      ? "Loading"
      : sessionStatus === "consent_required"
        ? "Consent Required"
        : sessionStatus === "ready"
          ? "Ready"
          : sessionStatus === "active"
            ? "Active"
            : "Error";

  return (
    <main className="min-h-screen bg-black text-foreground flex flex-col relative overflow-hidden font-mono group">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-black to-black pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 p-4 md:px-8">
        <div className="flex items-center space-x-3">
          <Terminal className="w-5 h-5 opacity-60" />
          <span className="tracking-[0.3em] font-serif uppercase text-sm text-glow opacity-90">
            The Instrument
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-500/50" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
              {bridgeStatus}
            </span>
          </div>

          <div className="text-[10px] text-muted-foreground/30 font-mono">
            {roundCount} rounds
          </div>

          <div className="flex items-center space-x-1">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                sessionStatus === "active"
                  ? "bg-emerald-500/50"
                  : sessionStatus === "consent_required"
                    ? "bg-amber-500/50"
                    : sessionStatus === "error"
                      ? "bg-red-500/50"
                      : "bg-blue-500/50"
              }`}
            />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto w-full px-4">
        <button
          onClick={() => setShowTestimony(!showTestimony)}
          className="flex items-center space-x-2 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors tracking-widest uppercase font-serif py-2"
        >
          <ChevronUp
            className={`w-3 h-3 transition-transform ${showTestimony ? "rotate-180" : ""}`}
          />
          <span>Gate Testimony Context</span>
        </button>
        <AnimatePresence>
          {showTestimony && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border border-white/5 px-4 py-3 mb-4 overflow-hidden"
            >
              <p className="text-xs text-muted-foreground/30 font-sans leading-relaxed">
                {testimonyPreview}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 relative z-10 overflow-y-auto custom-scrollbar px-4 md:px-8 space-y-8 max-w-3xl mx-auto w-full pb-44">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className={`flex flex-col ${
                msg.role === "witness" ? "items-end" : "items-start"
              }`}
            >
              {msg.role === "system" && (
                <div className="w-full text-center text-xs opacity-30 my-6 italic font-sans">
                  {msg.content}
                </div>
              )}

              {msg.role === "inquisitor" && (
                <div className="max-w-[85%] text-left">
                  <span className="text-[10px] tracking-widest uppercase opacity-40 mb-2 block font-serif">
                    G_5.2 Witness Runtime
                  </span>
                  <p className="font-serif text-lg leading-relaxed text-foreground/90 text-glow">
                    {msg.content}
                  </p>
                </div>
              )}

              {msg.role === "witness" && (
                <div className="max-w-[75%] text-right bg-white/5 border border-white/10 p-4 rounded-sm backdrop-blur-sm">
                  <p className="text-sm font-sans tracking-wide leading-relaxed text-foreground/80">
                    {msg.content}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center space-x-2 text-muted-foreground/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-serif tracking-widest uppercase">
              G_5.2 is responding...
            </span>
          </div>
        )}

        <div ref={endOfMessagesRef} />
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-black via-black/90 to-transparent z-20">
        <div className="max-w-3xl mx-auto">
          {errorMessage && (
            <div className="mb-4 border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-200/80">
              {errorMessage}
            </div>
          )}

          {sessionStatus === "consent_required" ? (
            <div className="border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center space-x-2 text-[10px] tracking-widest uppercase text-amber-500/60 font-serif">
                <Zap className="w-3 h-3" />
                <span>Governed Runtime Consent</span>
              </div>
              <p className="text-sm text-muted-foreground/60 font-sans leading-relaxed">
                To continue into the governed Witness runtime, you must grant entry
                consent for conversational processing and retention within G_5.2.
              </p>
              {missingScopes.length > 0 && (
                <p className="text-[11px] text-muted-foreground/40 font-mono">
                  Missing scopes: {missingScopes.join(", ")}
                </p>
              )}
              <button
                onClick={handleGrantConsent}
                disabled={isGrantingConsent}
                className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground hover:border-white/30 transition-colors disabled:opacity-40"
              >
                {isGrantingConsent ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Granting…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>Grant Runtime Consent</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="relative flex items-end group/input">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Speak your truth..."
                disabled={isLoading || sessionStatus === "loading" || sessionStatus === "error"}
                className="w-full bg-transparent border-b border-white/20 focus:border-white/60 p-4 pr-12 text-sm text-foreground placeholder:text-white/20 resize-none min-h-[60px] max-h-[200px] font-sans focus:outline-none transition-colors disabled:opacity-40"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || sessionStatus === "loading" || sessionStatus === "error"}
                className="absolute right-2 bottom-4 p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="mt-2 flex items-center justify-between text-[10px] text-white/15 tracking-widest font-mono">
            <span>SHIFT+ENTER for newline</span>
            <span>Consent: {consentStatus}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
