import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TheGateClient from "./gate-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Gate",
  description:
    "The Gate is the intake point for The Witness Protocol. Submit your testimony for evaluation through a three-tier vetting pipeline.",
};

/**
 * Server component wrapper for The Gate.
 * Checks authentication and redirects to /login if not authenticated.
 */
export default async function TheGatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <TheGateClient userEmail={user.email || ""} />;
}
