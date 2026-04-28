import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type EmailOtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

const emailOtpTypes = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && emailOtpTypes.has(value);
}

function getLocalRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/gate";
  }

  return value;
}

function redirectTo(path: string, origin: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * GET /auth/callback
 * 
 * Handles Supabase email auth callbacks.
 * Exchanges PKCE auth codes for a session, with token_hash verification as a
 * fallback for custom email templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getLocalRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectTo(next, origin);
    }

    console.error("Auth callback code exchange error:", error.message);
  }

  if (token_hash && isEmailOtpType(type)) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Recovery sessions must go to the password reset form, not the app.
      if (type === "recovery") {
        return redirectTo("/admin/reset-password", origin);
      }
      // Authenticated — redirect to the Gate (or wherever `next` points)
      return redirectTo(next, origin);
    }

    console.error("Auth callback verification error:", error.message);
  }

  // If verification failed, redirect to login with error hint
  return redirectTo("/login?error=verification_failed", origin);
}
