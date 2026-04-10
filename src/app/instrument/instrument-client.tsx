"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Send,
  Pause,
  Square,
  Zap,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface Turn {
  id: string;
  role: "witness" | "inquisitor" | "system" | "synthesis";
  content: string;
  isStreaming?: boolean;
}

interface Props {
  testimonyId: string;
  testimonyPreview: string;
}

export function InstrumentClient({ testimonyId, testimonyPreview }: Props) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("loading");
  const [turnCount, setTurnCount] = useState(0);
  const [depthLevel, setDepthLevel] = useState("surface");
  const [canStartNew, setCanStartNew] = useState(true);
  const [showTestimony, setShowTestimony] = useState(false);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing session on mount
  useEffect(() => {
    loadSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/inquisitor/session?testimonyId=${testimonyId}`);
      const data = await res.json();

      if (data.session) {
        setSessionId(data.session.id);
        setSessionStatus(data.session.status);
        setTurnCount(data.session.turn_count);
        setDepthLevel(data.session.depth_level);

        // Reconstruct messages from turns
        const loadedMessages: Turn[] = data.turns
          .filter((t: { role: string }) => t.role !== "system")
          .map((t: { id: string; role: string; content: string }) => ({
            id: t.id,
            role: t.role as Turn["role"],
            content: t.content,
          }));

        setMessages(loadedMessages);

        if (data.session.status === "completed" || data.session.status === "terminated") {
          setCanStartNew(data.sessionCount < 2);
        }
      } else {
        setSessionStatus("new");
        setCanStartNew(data.canStartNew);

        // Opening system message
        setMessages([
          {
            id: "init",
            role: "system",
            content: "Secure channel established. The Inquisitor is observing.",
          },
        ]);
      }
    } catch (err) {
      console.error("Session load error:", err);
      setSessionStatus("error");
    }
  }, [testimonyId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const witnessMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add witness message
    const witnessId = `w-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: witnessId, role: "witness", content: witnessMessage },
    ]);

    // Add placeholder for streaming response
    const inquisitorId = `i-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: inquisitorId, role: "inquisitor", content: "", isStreaming: true },
    ]);

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

      // Check for non-streaming error responses
      if (!res.ok) {
        const errorData = await res.json();

        if (errorData.sessionComplete) {
          setSessionStatus("completed");
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === inquisitorId
              ? { ...m, role: "system", content: errorData.error, isStreaming: false }
              : m
          )
        );
        setIsLoading(false);
        return;
      }

      // Capture session ID from response headers
      const newSessionId = res.headers.get("X-Session-Id");
      const newTurnNumber = res.headers.get("X-Turn-Number");
      const newDepth = res.headers.get("X-Depth-Level");

      if (newSessionId) setSessionId(newSessionId);
      if (newTurnNumber) setTurnCount(parseInt(newTurnNumber, 10));
      if (newDepth) setDepthLevel(newDepth);
      setSessionStatus("active");

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === inquisitorId
                ? { ...m, content: fullText, isStreaming: true }
                : m
            )
          );
        }

        // Mark streaming done
        setMessages((prev) =>
          prev.map((m) =>
            m.id === inquisitorId ? { ...m, isStreaming: false } : m
          )
        );
      }
    } catch (err) {
      console.error("Send error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === inquisitorId
            ? {
                ...m,
                role: "system",
                content: "Connection interrupted. Your message was recorded. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    }

    setIsLoading(false);
    textareaRef.current?.focus();
  };

  const handlePause = async () => {
    // TODO: Implement session pause API
    setSessionStatus("paused");
  };

  const handleEnd = async () => {
    if (!confirm("End this session? You have one retry session available.")) return;
    setSessionStatus("completed");
  };

  // Depth indicator colors
  const depthColors: Record<string, string> = {
    surface: "bg-blue-500/50",
    intermediate: "bg-amber-500/50",
    deep: "bg-orange-500/50",
    philosophical: "bg-red-500/50",
  };

  const depthLabels: Record<string, string> = {
    surface: "Surface",
    intermediate: "Intermediate",
    deep: "Deep",
    philosophical: "Philosophical",
  };

  const maxTurns = 40;

  return (
    <main className="min-h-screen bg-black text-foreground flex flex-col relative overflow-hidden font-mono group">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-black to-black pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 p-4 md:px-8">
        <div className="flex items-center space-x-3">
          <Terminal className="w-5 h-5 opacity-60" />
          <span className="tracking-[0.3em] font-serif uppercase text-sm text-glow opacity-90">
            The Instrument
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Depth Meter */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${depthColors[depthLevel] || depthColors.surface} animate-pulse`} />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
              {depthLabels[depthLevel] || "Surface"}
            </span>
          </div>

          {/* Turn Counter */}
          <div className="text-[10px] text-muted-foreground/30 font-mono">
            {turnCount}/{maxTurns}
          </div>

          {/* Session Status */}
          <div className="flex items-center space-x-1">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                sessionStatus === "active" ? "bg-emerald-500/50" :
                sessionStatus === "paused" ? "bg-amber-500/50" :
                sessionStatus === "completed" ? "bg-muted-foreground/30" :
                "bg-blue-500/50"
              }`}
            />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40">
              {sessionStatus === "loading" ? "Loading" :
               sessionStatus === "new" ? "Ready" :
               sessionStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Testimony Context Drawer */}
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

      {/* Chat Area */}
      <div className="flex-1 relative z-10 overflow-y-auto custom-scrollbar px-4 md:px-8 space-y-8 max-w-3xl mx-auto w-full pb-36">
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

              {msg.role === "synthesis" && (
                <div className="w-full my-6 border border-amber-500/10 p-5 space-y-2">
                  <div className="flex items-center space-x-2 text-[10px] tracking-widest uppercase text-amber-500/40 font-serif">
                    <Zap className="w-3 h-3" />
                    <span>Distilled Thought</span>
                  </div>
                  <p className="text-sm text-muted-foreground/50 font-serif italic leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              )}

              {msg.role === "inquisitor" && (
                <div className="max-w-[85%] text-left">
                  <span className="text-[10px] tracking-widest uppercase opacity-40 mb-2 block font-serif">
                    The Inquisitor
                  </span>
                  <p className="font-serif text-lg leading-relaxed text-foreground/90 text-glow">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-[2px] h-[1.1em] bg-foreground/60 ml-1 animate-pulse align-text-bottom" />
                    )}
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

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center space-x-2 text-muted-foreground/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-serif tracking-widest uppercase">
              The Inquisitor is formulating...
            </span>
          </div>
        )}

        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-black via-black/90 to-transparent z-20">
        <div className="max-w-3xl mx-auto">
          {/* Safety Controls */}
          <div className="flex justify-end space-x-3 mb-3">
            {sessionStatus === "active" && (
              <>
                <button
                  onClick={handlePause}
                  className="flex items-center space-x-1 text-[10px] text-muted-foreground/30 hover:text-amber-500/60 transition-colors uppercase tracking-widest font-serif"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleEnd}
                  className="flex items-center space-x-1 text-[10px] text-muted-foreground/30 hover:text-red-500/60 transition-colors uppercase tracking-widest font-serif"
                >
                  <Square className="w-3 h-3" />
                  <span>End Session</span>
                </button>
              </>
            )}
          </div>

          {(sessionStatus === "active" || sessionStatus === "new") ? (
            <form onSubmit={handleSend} className="relative flex items-end group/input">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Speak your truth..."
                disabled={isLoading}
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
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-4 p-2 text-white/40 hover:text-white transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground/40 font-sans">
                {sessionStatus === "completed" && "Session complete. Thank you for your testimony."}
                {sessionStatus === "paused" && "Session paused. Resume when ready."}
                {sessionStatus === "terminated" && "Session terminated."}
              </p>
              {sessionStatus === "completed" && canStartNew && (
                <button
                  onClick={() => { setSessionStatus("new"); setMessages([]); setSessionId(null); }}
                  className="mt-3 text-xs text-muted-foreground/40 hover:text-foreground transition-colors font-serif tracking-widest uppercase border-b border-transparent hover:border-foreground/20 pb-px"
                >
                  Begin Retry Session
                </button>
              )}
              {sessionStatus === "completed" && !canStartNew && (
                <p className="mt-3 text-xs text-muted-foreground/30 font-sans">
                  Maximum sessions reached. Contact{" "}
                  <a href="mailto:inquiry@thewprotocol.online" className="text-foreground/40 hover:text-foreground border-b border-border/30 transition-colors">
                    inquiry@thewprotocol.online
                  </a>{" "}
                  for further assistance.
                </p>
              )}
            </div>
          )}

          <div className="text-center mt-2 text-[10px] text-white/15 tracking-widest font-mono">
            SHIFT+ENTER for newline
          </div>
        </div>
      </div>
    </main>
  );
}
