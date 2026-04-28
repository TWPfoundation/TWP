"use client";

import { motion } from "framer-motion";

interface SectionShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function SectionShell({ title, subtitle, children, actions }: SectionShellProps) {
  return (
    <div className="pt-24 pb-16 px-8 space-y-10 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div className="text-center space-y-2 flex-1">
          <h1 className="text-2xl font-light tracking-widest text-foreground text-glow uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground/40 font-mono tracking-wide">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="ml-4 shrink-0">{actions}</div>}
      </motion.div>

      {children}
    </div>
  );
}
