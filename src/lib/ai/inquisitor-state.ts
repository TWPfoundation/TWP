/**
 * Inquisitor Conversation State Machine
 *
 * Tracks depth, question/statement ratio, distress signals,
 * synthesis milestones, and topic coverage for each session.
 */

export type DepthLevel = "surface" | "intermediate" | "deep" | "philosophical";

export interface ConversationState {
  sessionId: string;
  turnCount: number;
  questionCount: number;
  statementCount: number;
  depthLevel: DepthLevel;
  topicsCovered: string[];
  distressSignals: number;
  synthesisHistory: number[]; // Turn numbers where synthesis was generated
  lastSynthesisAt: number;
}

// ─── Depth Progression ──────────────────────────────────

const DEPTH_THRESHOLDS: Record<DepthLevel, number> = {
  surface: 0,
  intermediate: 6,
  deep: 15,
  philosophical: 28,
};

export function computeDepth(turnCount: number): DepthLevel {
  if (turnCount >= DEPTH_THRESHOLDS.philosophical) return "philosophical";
  if (turnCount >= DEPTH_THRESHOLDS.deep) return "deep";
  if (turnCount >= DEPTH_THRESHOLDS.intermediate) return "intermediate";
  return "surface";
}

// ─── 70/30 Ratio Enforcement ────────────────────────────

export function getQuestionRatio(state: ConversationState): number {
  const total = state.questionCount + state.statementCount;
  if (total === 0) return 1.0;
  return state.questionCount / total;
}

export function shouldForceQuestion(state: ConversationState): boolean {
  // If ratio has dropped below 70%, the next Inquisitor turn must be a question
  return getQuestionRatio(state) < 0.7 && state.turnCount > 4;
}

// ─── Distress Detection ─────────────────────────────────

const DISTRESS_PATTERNS = [
  /\b(suicid|kill\s+my\s*self|end\s+(it|my\s+life)|want\s+to\s+die)\b/i,
  /\b(self[\s-]?harm|hurt\s+my\s*self|cutting)\b/i,
  /\b(can'?t\s+go\s+on|no\s+reason\s+to\s+live|hopeless)\b/i,
  /\b(abuse|assault|domestic\s+violence|being\s+hit)\b/i,
];

const DISTRESS_SOFT_PATTERNS = [
  /\b(overwhelm|can'?t\s+cope|breaking\s+down|falling\s+apart)\b/i,
  /\b(panic\s+attack|anxiety|terrif|scared)\b/i,
  /\b(crying|sobbing|tears)\b/i,
];

export type DistressLevel = "none" | "soft" | "crisis";

export function detectDistress(text: string): DistressLevel {
  for (const pattern of DISTRESS_PATTERNS) {
    if (pattern.test(text)) return "crisis";
  }
  for (const pattern of DISTRESS_SOFT_PATTERNS) {
    if (pattern.test(text)) return "soft";
  }
  return "none";
}

// ─── Synthesis Triggers ─────────────────────────────────

const SYNTHESIS_INTERVAL = 15; // Generate synthesis every N turns

export function shouldTriggerSynthesis(state: ConversationState): boolean {
  const turnsSinceLast = state.turnCount - state.lastSynthesisAt;
  return turnsSinceLast >= SYNTHESIS_INTERVAL && state.turnCount >= SYNTHESIS_INTERVAL;
}

// ─── Session Limits ─────────────────────────────────────

export const MAX_TURNS = 40;
export const MAX_SESSIONS_PER_TESTIMONY = 2; // 1 original + 1 retry

export function isSessionComplete(state: ConversationState): boolean {
  return state.turnCount >= MAX_TURNS;
}

// ─── State Updater ──────────────────────────────────────

export function updateState(
  state: ConversationState,
  role: "witness" | "inquisitor",
  content: string,
  isQuestion?: boolean
): ConversationState {
  const newState = { ...state };
  newState.turnCount += 1;
  newState.depthLevel = computeDepth(newState.turnCount);

  if (role === "inquisitor") {
    // Detect if the Inquisitor turn is a question or statement
    const isQ = isQuestion ?? content.trim().endsWith("?");
    if (isQ) {
      newState.questionCount += 1;
    } else {
      newState.statementCount += 1;
    }
  }

  if (role === "witness") {
    const distress = detectDistress(content);
    if (distress !== "none") {
      newState.distressSignals += 1;
    }
  }

  return newState;
}

// ─── Depth-aware prompt injection ───────────────────────

export function getDepthDirective(depth: DepthLevel): string {
  switch (depth) {
    case "surface":
      return "The witness is in early disclosure. Ask open, inviting questions. Establish trust. Do not challenge yet.";
    case "intermediate":
      return "The witness has shared substantive detail. Begin probing contradictions gently. Use 5-Whys style follow-ups. Start steel-manning their position before questioning it.";
    case "deep":
      return "The witness is in deep introspection. Challenge assumptions directly. Ask counterfactual questions. Explore the philosophical underpinnings of their choices.";
    case "philosophical":
      return "The witness has reached philosophical depth. Engage with their framework on its own terms. Ask about the universalizability of their principles. Probe the limits of their moral architecture.";
  }
}
