"use client";

import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-border/10">
      <div className="max-w-5xl mx-auto flex items-center justify-between py-3 px-6">
        <Link href="/" className="flex items-center space-x-3 group">
          <Image
            src="/twp-logo-white.png"
            alt="TWP"
            width={28}
            height={28}
            className="opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <span className="font-serif text-sm tracking-[0.2em] uppercase text-foreground/60 group-hover:text-foreground/90 transition-colors hidden sm:inline">
            The Witness Protocol
          </span>
        </Link>

        <nav className="flex items-center space-x-5 text-[10px] tracking-[0.2em] uppercase font-serif">
          <Link href="/status" className="text-muted-foreground/50 hover:text-foreground transition-colors">
            Status
          </Link>
          <Link href="/failure-log" className="text-muted-foreground/50 hover:text-foreground transition-colors">
            Failures
          </Link>
          <Link href="/governance" className="text-muted-foreground/50 hover:text-foreground transition-colors">
            Governance
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center space-x-1 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <UserIcon className="w-3 h-3" />
                <span className="hidden md:inline">Dashboard</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-foreground/60 hover:text-foreground transition-colors border border-border/30 hover:border-foreground/30 px-3 py-1"
            >
              Authenticate
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
