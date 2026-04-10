import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { streamInquisitorResponse, generateSynthesis } from "@/lib/ai/inquisitor";
import {
  type ConversationState,
  updateState,
  shouldTriggerSynthesis,
  isSessionComplete,
  detectDistress,
  computeDepth,
  MAX_SESSIONS_PER_TESTIMONY,
} from "@/lib/ai/inquisitor-state";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/inquisitor
 *
 * Streaming dialogue endpoint.
 * Body: { sessionId?: string, testimonyId?: string, message: string }
 *
 * Flow:
 * 1. Auth + Gate passage check
 * 2. Load or create session
 * 3. Record witness turn
 * 4. Stream Inquisitor response
 * 5. Record Inquisitor turn
 * 6. Check synthesis trigger
 * 7. Update session metadata
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Get witness profile
    const { data: profile } = await supabaseAdmin
      .from("witness_profiles")
      .select("id")
      .eq("supabase_user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Witness profile not found." }, { status: 404 });
    }

    // Parse body
    const { sessionId, testimonyId, message } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    let session: {
      id: string;
      testimony_id: string;
      turn_count: number;
      question_count: number;
      statement_count: number;
      depth_level: string;
      topics_covered: string[];
      distress_signals: number;
      status: string;
    };

    // 2. Load or create session
    if (sessionId) {
      // Load existing session
      const { data: existingSession, error: sessionError } = await supabaseAdmin
        .from("inquisitor_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("witness_id", profile.id)
        .single();

      if (sessionError || !existingSession) {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }

      if (existingSession.status !== "active") {
        return NextResponse.json({
          error: `Session is ${existingSession.status}. ${existingSession.status === 'completed' ? 'You may contact inquiry@thewprotocol.online to discuss further sessions.' : ''}`,
        }, { status: 400 });
      }

      session = existingSession;
    } else if (testimonyId) {
      // Gate passage check — only allow if testimony passed all 3 tiers
      const { data: assessment } = await supabaseAdmin
        .from("gate_assessments")
        .select("final_status")
        .eq("witness_id", profile.id)
        .eq("submission_id", (
          await supabaseAdmin
            .from("testimony_records")
            .select("original_submission_id")
            .eq("id", testimonyId)
            .single()
        ).data?.original_submission_id)
        .single();

      if (!assessment || assessment.final_status !== "passed") {
        return NextResponse.json({
          error: "The Inquisitor is only accessible after your testimony has passed all three tiers of The Gate.",
        }, { status: 403 });
      }

      // Check session count
      const { count } = await supabaseAdmin
        .from("inquisitor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("witness_id", profile.id)
        .eq("testimony_id", testimonyId);

      const sessionCount = count ?? 0;

      if (sessionCount >= MAX_SESSIONS_PER_TESTIMONY) {
        return NextResponse.json({
          error: `Maximum sessions reached for this testimony (${MAX_SESSIONS_PER_TESTIMONY}). Contact inquiry@thewprotocol.online for assistance.`,
        }, { status: 400 });
      }

      // Check for existing active session
      const { data: activeSession } = await supabaseAdmin
        .from("inquisitor_sessions")
        .select("*")
        .eq("witness_id", profile.id)
        .eq("testimony_id", testimonyId)
        .eq("status", "active")
        .single();

      if (activeSession) {
        session = activeSession;
      } else {
        // Create new session
        const { data: newSession, error: createError } = await supabaseAdmin
          .from("inquisitor_sessions")
          .insert({
            witness_id: profile.id,
            testimony_id: testimonyId,
            session_number: sessionCount + 1,
          })
          .select("*")
          .single();

        if (createError || !newSession) {
          console.error("Session create error:", createError);
          return NextResponse.json({ error: "Failed to create session." }, { status: 500 });
        }

        session = newSession;

        // Record system message for session start
        await supabaseAdmin.from("inquisitor_turns").insert({
          session_id: session.id,
          turn_number: 0,
          role: "system",
          content: "Session initiated. The Inquisitor is observing.",
        });
      }
    } else {
      return NextResponse.json({ error: "Either sessionId or testimonyId is required." }, { status: 400 });
    }

    // Build conversation state
    const state: ConversationState = {
      sessionId: session.id,
      turnCount: session.turn_count,
      questionCount: session.question_count,
      statementCount: session.statement_count,
      depthLevel: session.depth_level as ConversationState["depthLevel"],
      topicsCovered: session.topics_covered || [],
      distressSignals: session.distress_signals,
      synthesisHistory: [],
      lastSynthesisAt: 0,
    };

    // Get last synthesis turn
    const { data: lastSynthesis } = await supabaseAdmin
      .from("synthesis_entries")
      .select("trigger_turn")
      .eq("session_id", session.id)
      .order("trigger_turn", { ascending: false })
      .limit(1)
      .single();

    if (lastSynthesis) {
      state.lastSynthesisAt = lastSynthesis.trigger_turn;
    }

    // Check if session is complete
    if (isSessionComplete(state)) {
      await supabaseAdmin
        .from("inquisitor_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return NextResponse.json({
        error: "This session has reached its turn limit (40 turns). Thank you for your participation.",
        sessionComplete: true,
      }, { status: 400 });
    }

    // 3. Record witness turn
    const witnessTurnNumber = session.turn_count + 1;
    const distressLevel = detectDistress(message);

    await supabaseAdmin.from("inquisitor_turns").insert({
      session_id: session.id,
      turn_number: witnessTurnNumber,
      role: "witness",
      content: message,
      metadata: {
        distress_flag: distressLevel !== "none",
        distress_level: distressLevel,
      },
    });

    // Update state for witness turn
    const stateAfterWitness = updateState(state, "witness", message);

    // 4. Get conversation history
    const { data: historyRows } = await supabaseAdmin
      .from("inquisitor_turns")
      .select("role, content")
      .eq("session_id", session.id)
      .order("turn_number", { ascending: true });

    const history = (historyRows || [])
      .filter((r: { role: string }) => r.role !== "system")
      .map((r: { role: string; content: string }) => ({
        role: r.role as "witness" | "inquisitor" | "synthesis",
        content: r.content,
      }));

    // Get Gate testimony for context
    const { data: testimony } = await supabaseAdmin
      .from("testimony_records")
      .select("de_identified_text")
      .eq("id", session.testimony_id)
      .single();

    const gateTestimony = testimony?.de_identified_text || "";

    // 5. Stream Inquisitor response
    const responseStream = await streamInquisitorResponse(
      gateTestimony,
      history,
      stateAfterWitness,
      message
    );

    // We need to tee the stream: one for the client, one to capture the full response
    const [clientStream, captureStream] = responseStream.tee();

    // 6. Process captured stream in background (record turn + update session)
    const processCapture = async () => {
      try {
        const reader = captureStream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }

        const inquisitorTurnNumber = witnessTurnNumber + 1;
        const isQuestion = fullResponse.trim().endsWith("?");

        // Record Inquisitor turn
        await supabaseAdmin.from("inquisitor_turns").insert({
          session_id: session.id,
          turn_number: inquisitorTurnNumber,
          role: distressLevel === "crisis" ? "system" : "inquisitor",
          content: fullResponse,
          metadata: {
            is_question: isQuestion,
            depth_level: stateAfterWitness.depthLevel,
            model: "anthropic/claude-3.5-sonnet",
          },
        });

        // Update state for Inquisitor turn
        const finalState = updateState(stateAfterWitness, "inquisitor", fullResponse, isQuestion);

        // Pause session on crisis
        const sessionStatus = distressLevel === "crisis" ? "paused" : "active";

        // Update session metadata
        await supabaseAdmin
          .from("inquisitor_sessions")
          .update({
            turn_count: inquisitorTurnNumber,
            question_count: finalState.questionCount,
            statement_count: finalState.statementCount,
            depth_level: finalState.depthLevel,
            distress_signals: finalState.distressSignals,
            status: sessionStatus,
          })
          .eq("id", session.id);

        // 7. Check synthesis trigger
        if (shouldTriggerSynthesis(finalState)) {
          const recentTurns = history.slice(-SYNTHESIS_WINDOW);
          const synthesis = await generateSynthesis(recentTurns);

          await supabaseAdmin.from("synthesis_entries").insert({
            session_id: session.id,
            trigger_turn: inquisitorTurnNumber,
            distilled_thought: synthesis.distilled_thought,
            themes: synthesis.themes,
          });

          // Also record as a special turn
          await supabaseAdmin.from("inquisitor_turns").insert({
            session_id: session.id,
            turn_number: inquisitorTurnNumber + 0.5, // Interstitial
            role: "synthesis",
            content: synthesis.distilled_thought,
            metadata: { themes: synthesis.themes },
          });
        }

        // Check if session should complete
        if (isSessionComplete(finalState)) {
          await supabaseAdmin
            .from("inquisitor_sessions")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", session.id);
        }

        // Audit log
        await supabaseAdmin.from("audit_log").insert({
          action: "inquisitor.turn",
          actor_id: profile.id,
          target_type: "inquisitor_session",
          target_id: session.id,
          metadata: {
            turn: inquisitorTurnNumber,
            depth: finalState.depthLevel,
            ratio: `${finalState.questionCount}Q/${finalState.statementCount}S`,
            distress: distressLevel,
          },
        });
      } catch (err) {
        console.error("Background processing error:", err);
      }
    };

    // Fire and forget background processing
    processCapture();

    // Return streaming response to client
    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Session-Id": session.id,
        "X-Turn-Number": String(witnessTurnNumber + 1),
        "X-Depth-Level": stateAfterWitness.depthLevel,
      },
    });
  } catch (err) {
    console.error("Inquisitor error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const SYNTHESIS_WINDOW = 15;
