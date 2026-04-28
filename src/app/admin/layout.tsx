import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { AdminSidebar } from "@/components/admin/sidebar";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Admin layout with sidebar navigation.
 * Protects all /admin/* routes via Supabase Auth session + admin_roles check.
 * No cookie passphrase — hard-cut to identity-based auth.
 *
 * Security: calling headers() opts this layout out of Next.js static caching,
 * ensuring admin responses are never served from a shared CDN/proxy cache.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Calling headers() forces dynamic rendering (no-store semantics)
  await headers();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // Check admin_roles table
  const { data: adminRole } = await supabaseAdmin
    .from("admin_roles")
    .select("role, email")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!adminRole) {
    // User is authenticated but not an admin — show children (login page
    // or access denied) without the admin sidebar
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={adminRole.role} email={adminRole.email} />
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
