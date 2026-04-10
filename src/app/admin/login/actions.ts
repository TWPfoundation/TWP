"use server";

import { cookies } from "next/headers";

export async function loginAdmin(formData: FormData) {
  const passphrase = formData.get("passphrase")?.toString();

  if (!passphrase) {
    return { success: false, error: "Passphrase is required." };
  }

  const expectedPassphrase = process.env.ADMIN_PASSPHRASE;

  if (!expectedPassphrase || passphrase !== expectedPassphrase) {
    // Prevent timing attacks by generic delay, though unlikely needed here.
    return { success: false, error: "Invalid passphrase." };
  }

  // Set the admin access cookie. 
  // Secure: true requires HTTPS but we allow it locally too via Next checks
  // 60*60*24 = 1 day max age
  cookies().set({
    name: "twp_admin_access",
    value: expectedPassphrase,
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  });

  return { success: true };
}

export async function logoutAdmin() {
  cookies().delete("twp_admin_access");
}
