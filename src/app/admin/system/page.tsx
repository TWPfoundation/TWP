import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { SystemClient } from "@/components/admin/system-client";

export const metadata = {
  title: "System Config | TWP Operator",
};

export default async function SystemPage() {
  const auth = await requireAdmin();
  if (auth.error) redirect("/admin/login");

  return <SystemClient />;
}
