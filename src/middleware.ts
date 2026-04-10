import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all routes that need auth session refresh:
     * - /gate (witness intake — now auth-gated)
     * - /instrument (Inquisitor — auth-gated)
     * - /dashboard (witness dashboard)
     * - /admin (admin routes)
     * - /auth (auth callback)
     * Skip static files and API routes that handle their own auth.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.png|twp-logo-white.png|twp-logo-black.png|monitoring|api/).*)',
  ],
};
