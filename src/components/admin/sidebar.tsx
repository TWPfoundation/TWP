"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield,
  BarChart3,
  BookOpen,
  LogOut,
  Inbox,
  ChevronRight,
  Activity,
  FileArchive,
  Settings,
} from "lucide-react";
import { logoutAdmin } from "@/app/admin/login/actions";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/gate", label: "Gate Queue", icon: Inbox },
  { href: "/admin/corpus", label: "Corpus", icon: BookOpen },
];

const OPERATOR_NAV_ITEMS = [
  { href: "/admin/engine", label: "Engine Health", icon: Activity },
  { href: "/admin/publications", label: "Publications", icon: FileArchive },
  { href: "/admin/system", label: "System Config", icon: Settings },
];

interface AdminSidebarProps {
  role: string;
  email: string;
}

export function AdminSidebar({ role, email }: AdminSidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutAdmin();
  };

  const roleLabel = role.toUpperCase();
  const emailShort = email.split("@")[0];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-border/10 bg-black/30 backdrop-blur-sm flex flex-col z-50">
      {/* Header */}
      <div className="p-6 space-y-2 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500/60" />
          <span className="font-serif text-xs tracking-[0.2em] text-foreground/70 uppercase">
            Administration
          </span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground/30 tracking-wide">
          {roleLabel} · {emailShort}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 text-xs font-serif tracking-widest uppercase transition-all duration-300 ${
                isActive
                  ? "text-foreground bg-white/5 border-l-2 border-red-500/50"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 border-l-2 border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
              )}
            </Link>
          );
        })}

        {/* Operator divider */}
        <div className="pt-3 pb-1">
          <div className="border-t border-border/10" />
          <p className="text-[8px] font-mono text-muted-foreground/20 uppercase tracking-[0.25em] pt-2 px-3">
            Engine
          </p>
        </div>

        {OPERATOR_NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 text-xs font-serif tracking-widest uppercase transition-all duration-300 ${
                isActive
                  ? "text-foreground bg-white/5 border-l-2 border-cyan-500/40"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 border-l-2 border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/10 space-y-3">
        <Link
          href="/"
          className="block text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors font-mono tracking-wide"
        >
          ← Public Site
        </Link>
        <form action={handleLogout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-[10px] text-red-500/40 hover:text-red-400/60 transition-colors font-mono tracking-wide w-full"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
