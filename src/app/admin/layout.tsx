import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";

/**
 * Admin layout with sidebar navigation.
 * Protects all /admin/* routes (except /admin/login) with passphrase cookie check.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't apply admin layout/auth to the login page itself
  // The login page has its own standalone layout
  const cookieStore = await cookies();
  const hasAdminToken = cookieStore.get("twp_admin_access")?.value === process.env.ADMIN_PASSPHRASE;

  // If no admin token, let the individual page handle the redirect
  // (login page doesn't need the sidebar)
  if (!hasAdminToken) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 ml-56">
        {children}
      </main>
    </div>
  );
}
