import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { AdminSidebar } from "@/components/admin/sidebar";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Admin layout — sidebar chrome only.
 *
 * This layout NEVER redirects. Redirecting to /admin/login from here
 * creates an infinite loop because /admin/login is itself under this layout.
 *
 * Auth enforcement is handled at the page level:
 *   - Protected pages call requireAdmin() and redirect themselves.
 *   - The login page handles its own auth state client-side.
 *
 * This layout only adds the sidebar chrome when the user is a verified admin.
 * Calling headers() forces dynamic rendering (no CDN/proxy caching).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers(); // opt out of static caching

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session — show page as-is (login page renders its form; protected
  // pages redirect themselves via their own requireAdmin() calls).
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated — check for an admin role.
  const { data: adminRole } = await supabaseAdmin
    .from("admin_roles")
    .select("role, email")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  // No admin role — render without sidebar (e.g. login page after sign-in
  // with a non-admin account).
  if (!adminRole) {
    return <>{children}</>;
  }

  // Verified admin — render with sidebar.
  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={adminRole.role} email={adminRole.email} />
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
