import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { EngineClient } from "@/components/admin/engine-client";

export const metadata = {
  title: "Engine Health | TWP Operator",
};

export default async function EnginePage() {
  const auth = await requireAdmin();
  if (auth.error) redirect("/admin/login");

  return <EngineClient />;
}
