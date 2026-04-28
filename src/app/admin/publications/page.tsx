import { requireAdmin } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { PublicationsClient } from "@/components/admin/publications-client";

export const metadata = {
  title: "Publications | TWP Operator",
};

export default async function PublicationsPage() {
  const auth = await requireAdmin();
  if (auth.error) redirect("/admin/login");

  return <PublicationsClient />;
}
