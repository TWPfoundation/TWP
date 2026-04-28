"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: string;
  sub?: string;
}

export function StatCard({ icon: Icon, label, value, accent, sub }: StatCardProps) {
  return (
    <motion.div
      {...fadeIn}
      className="border border-border/10 bg-white/[0.02] p-5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${accent || "text-muted-foreground/40"}`} />
        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-2xl font-light text-foreground/80 tracking-wide">{value}</p>
      {sub && (
        <p className="text-[10px] font-mono text-muted-foreground/30">{sub}</p>
      )}
    </motion.div>
  );
}
