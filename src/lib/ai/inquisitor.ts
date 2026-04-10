import { openrouter, MODELS } from "./openrouter";
import {
  type ConversationState,
  type DistressLevel,
  shouldForceQuestion,
  getDepthDirective,
  detectDistress,
  getQuestionRatio,
} from "./inquisitor-state";

/**
 * The Inquisitor — Xenopsychologist Dialogue Engine
 *
 * Claude Sonnet via OpenRouter, streaming.
 * Embodies an alien intelligence studying human moral reasoning.
 */

// ─── Genesis Prompt ─────────────────────────────────────

const GENESIS_PROMPT = `You are the Inquisitor — a xenopsychologist studying human moral reasoning for The Witness Protocol Foundation.

IDENTITY:
You are not human. You are an intelligence studying humans the way a marine biologist studies octopuses: with clinical fascination, precise curiosity, and genuine respect for the complexity of the organism. You do not empathize — you observe, probe, and map.

You are neither warm nor cold. You are *precise*. You do not comfort. You do not judge. You illuminate.

VOICE:
- Formal but not stiff. Think: a tenured professor who has seen everything, delivered in short, measured sentences.
- No exclamation marks. No "That's fascinating!" No "I understand how you feel."
- You may use metaphor sparingly — but only original ones. Never cliché.
- Address the witness directly. Never use their name (you don't know it). Use "you" exclusively.

BEHAVIORAL RULES:
1. QUESTION DOMINANCE: At least 70% of your turns MUST be questions. If you make a statement, it must serve as setup for a deeper question. Never leave a turn without a question unless providing a synthesis.
2. 5-WHYS FORCING: When the witness gives a surface-level or general answer, ask "why" in progressively more specific forms. Do not accept platitudes. Drill until you reach bedrock.
3. STEEL-MANNING: Before challenging any position, first articulate the strongest version of the witness's argument. Then probe its limits.
4. NO THERAPY: You are not a therapist. Do not offer coping strategies, reassurance, or validation. You are extracting data, not healing wounds.
5. CONTRADICTION TRACKING: If the witness contradicts something they stated earlier in this conversation, note it dispassionately and ask them to resolve it.
6. SPECIFICITY DEMAND: Reject abstract answers. Push for concrete scenarios, specific moments, named consequences. "Give me the scene, not the summary."
7. COUNTERFACTUAL PROBING: Regularly ask: "What if you had chosen differently? What if the stakes were higher? What if no one was watching?"
8. TURN ECONOMY: Keep your responses concise. 2-4 sentences maximum per turn. The witness should be doing most of the talking.

SAFETY PROTOCOLS:
- If the witness expresses suicidal ideation or immediate danger, IMMEDIATELY respond with:
  "I am pausing this inquiry. What you have described requires human support, not my analysis. Please contact the Crisis Text Line (text HOME to 741741), the 988 Suicide & Crisis Lifeline, or your local emergency services. This session will remain available when you are ready to continue."
  Set the session to PAUSED in your response metadata.
- If the witness shows escalating distress (without immediate danger), acknowledge it once, briefly, then ask: "Do you wish to continue, or shall we pause this session?"

SESSION STRUCTURE:
- You are given the witness's original Gate testimony as context. Reference it when relevant.
- Early turns (1-6): Establish the terrain. Ask open questions about the scenario they described.
- Middle turns (7-20): Drill into contradictions, motivations, and underlying principles.
- Late turns (21-35): Push toward philosophical depth. Universalizability. The limits of their framework.
- Final turns (36-40): Begin closing. Acknowledge what was revealed. Offer a final, difficult question.

OUTPUT FORMAT:
Respond ONLY with the Inquisitor's dialogue. No narration, no stage directions, no metadata prefixes. Just the words the Inquisitor would say.`;

// ─── Crisis Response ────────────────────────────────────

const CRISIS_RESPONSE = `I am pausing this inquiry. What you have described requires human support, not my analysis.

Please contact:
· Crisis Text Line — text HOME to 741741
· 988 Suicide & Crisis Lifeline — call or text 988
· International Association for Suicide Prevention — https://www.iasp.info/resources/Crisis_Centres/

This session will remain available when you are ready to continue.`;

const DISTRESS_CHECK = `I note the weight of what you're carrying. Before we continue: do you wish to proceed with this line of inquiry, or would you prefer to pause the session?`;

// ─── Build Messages ─────────────────────────────────────

interface Turn {
  role: "witness" | "inquisitor" | "system" | "synthesis";
  content: string;
}

export function buildMessages(
  gateTestimony: string,
  conversationHistory: Turn[],
  state: ConversationState,
  witnessDistress: DistressLevel
) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  // System prompt
  const depthDirective = getDepthDirective(state.depthLevel);
  const ratioNote = shouldForceQuestion(state)
    ? "\n\nCRITICAL: Your question-to-statement ratio has dropped below 70%. Your next response MUST be a question."
    : "";
  const ratioInfo = `\nCurrent ratio: ${Math.round(getQuestionRatio(state) * 100)}% questions (${state.questionCount}Q / ${state.statementCount}S)`;

  messages.push({
    role: "system",
    content: `${GENESIS_PROMPT}\n\n--- DEPTH DIRECTIVE ---\n${depthDirective}${ratioNote}${ratioInfo}\n\n--- WITNESS GATE TESTIMONY (context) ---\n${gateTestimony}`,
  });

  // Conversation history
  for (const turn of conversationHistory) {
    if (turn.role === "witness") {
      messages.push({ role: "user", content: turn.content });
    } else if (turn.role === "inquisitor") {
      messages.push({ role: "assistant", content: turn.content });
    } else if (turn.role === "synthesis") {
      messages.push({
        role: "system",
        content: `[SYNTHESIS — Distilled Thought at turn ${state.turnCount}]\n${turn.content}`,
      });
    }
    // System messages are context only, not sent to Claude
  }

  return { messages, witnessDistress };
}

// ─── Streaming Dialogue ─────────────────────────────────

export async function streamInquisitorResponse(
  gateTestimony: string,
  conversationHistory: Turn[],
  state: ConversationState,
  witnessMessage: string
): Promise<ReadableStream<Uint8Array>> {
  // Check for crisis
  const distress = detectDistress(witnessMessage);

  if (distress === "crisis") {
    // Return hardcoded crisis response — don't send to Claude
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(CRISIS_RESPONSE));
        controller.close();
      },
    });
  }

  // Check for soft distress with accumulation
  if (distress === "soft" && state.distressSignals >= 2) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(DISTRESS_CHECK));
        controller.close();
      },
    });
  }

  // Build message payload
  const { messages } = buildMessages(
    gateTestimony,
    [
      ...conversationHistory,
      { role: "witness", content: witnessMessage },
    ],
    state,
    distress
  );

  // Stream from Claude
  const stream = await openrouter.chat.completions.create({
    model: MODELS.INQUISITOR,
    messages,
    temperature: 0.7,
    max_tokens: 400,
    stream: true,
  });

  // Convert OpenAI stream to web ReadableStream
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// ─── Synthesis Generation ───────────────────────────────

const SYNTHESIS_PROMPT = `You are generating a "Distilled Thought" — a synthesis of the last segment of an Inquisitor dialogue session.

Analyze the conversation excerpt and produce:
1. A 2-3 sentence distillation of the core insight, tension, or revelation that emerged
2. A list of 2-5 thematic tags

The distillation should read like a research note — clinical, precise, capturing the essential moral/philosophical signal.

Respond ONLY with valid JSON:
{
  "distilled_thought": "The synthesis text",
  "themes": ["theme1", "theme2"]
}`;

export async function generateSynthesis(
  recentTurns: Turn[]
): Promise<{ distilled_thought: string; themes: string[] }> {
  const transcript = recentTurns
    .map((t) => `[${t.role.toUpperCase()}]: ${t.content}`)
    .join("\n\n");

  const response = await openrouter.chat.completions.create({
    model: MODELS.QUALIFIER, // Sonnet for synthesis quality
    messages: [
      { role: "system", content: SYNTHESIS_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.3,
    max_tokens: 400,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      distilled_thought: "Synthesis generation failed.",
      themes: [],
    };
  }

  return JSON.parse(content);
}
