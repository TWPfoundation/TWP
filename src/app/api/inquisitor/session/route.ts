import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/inquisitor/session?testimonyId=xxx
 *
 * Returns the current session state for a given testimony.
 * Used by the Instrument UI to resume sessions and display status.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("witness_profiles")
      .select("id")
      .eq("supabase_user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const testimonyId = url.searchParams.get("testimonyId");

    if (!testimonyId) {
      // Return all sessions for this witness
      const { data: sessions } = await supabaseAdmin
        .from("inquisitor_sessions")
        .select("id, testimony_id, session_number, status, turn_count, depth_level, created_at, completed_at")
        .eq("witness_id", profile.id)
        .order("created_at", { ascending: false });

      return NextResponse.json({ sessions: sessions || [] });
    }

    // Return specific session + turns
    const { data: session } = await supabaseAdmin
      .from("inquisitor_sessions")
      .select("*")
      .eq("witness_id", profile.id)
      .eq("testimony_id", testimonyId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      // Check session count for "can start new" status
      const { count } = await supabaseAdmin
        .from("inquisitor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("witness_id", profile.id)
        .eq("testimony_id", testimonyId);

      return NextResponse.json({
        session: null,
        canStartNew: (count ?? 0) < 2,
        sessionCount: count ?? 0,
      });
    }

    // Load turns
    const { data: turns } = await supabaseAdmin
      .from("inquisitor_turns")
      .select("id, turn_number, role, content, metadata, created_at")
      .eq("session_id", session.id)
      .order("turn_number", { ascending: true });

    // Load synthesis entries
    const { data: syntheses } = await supabaseAdmin
      .from("synthesis_entries")
      .select("*")
      .eq("session_id", session.id)
      .order("trigger_turn", { ascending: true });

    return NextResponse.json({
      session,
      turns: turns || [],
      syntheses: syntheses || [],
      canStartNew: false,
    });
  } catch (err) {
    console.error("Session fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
