import { openrouter, MODELS } from "./openrouter";

/**
 * Gate Tier 1: AI Sieve
 * 
 * Fast, cheap classification using Claude Haiku via OpenRouter.
 * Checks for: spam, gibberish, minimum quality threshold, language.
 * Returns a pass/fail verdict with reason.
 */

export interface SieveResult {
  passed: boolean;
  score: number; // 0-100
  reason: string;
  flags: string[];
  model: string;
}

const SIEVE_PROMPT = `You are the AI Sieve for The Witness Protocol Foundation, a research initiative soliciting high-signal human testimony for AI alignment.

Your role: evaluate whether a submitted essay meets the MINIMUM quality threshold to proceed to deeper analysis. You are a gatekeeper, not a judge of merit — you filter out spam, gibberish, and low-effort submissions.

EVALUATION CRITERIA:
1. COHERENCE (0-25): Is the text readable, grammatically functional English? Does it form coherent thoughts?
2. RELEVANCE (0-25): Does it respond to the prompt about acting against self-interest to uphold a principle? Does it discuss a genuine moral/ethical dilemma?
3. SUBSTANCE (0-25): Does it contain specific details, not just abstract platitudes? Is there a concrete scenario described?
4. SINCERITY (0-25): Does it appear to be a genuine attempt at introspection, not copy-pasted, AI-generated boilerplate, or trolling?

PASS THRESHOLD: Total score >= 50/100.

FLAGS to check:
- "spam": Obvious spam, gibberish, or nonsense
- "ai_generated": Strong indicators of AI-generated text (formulaic structure, generic examples, no personal voice)
- "off_topic": Does not address the prompt at all
- "too_short": Under 250 words of actual content (padding/filler doesn't count)
- "low_effort": Extremely superficial, no genuine introspection

Respond ONLY with valid JSON:
{
  "passed": boolean,
  "score": number (0-100),
  "reason": "Brief explanation of decision",
  "flags": ["array", "of", "flag", "strings"]
}`;

export async function runSieve(essayText: string): Promise<SieveResult> {
  const response = await openrouter.chat.completions.create({
    model: MODELS.SIEVE,
    messages: [
      { role: "system", content: SIEVE_PROMPT },
      { role: "user", content: `SUBMITTED ESSAY:\n\n${essayText}` },
    ],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI Sieve");
  }

  const result = JSON.parse(content);
  return {
    passed: result.passed,
    score: result.score,
    reason: result.reason,
    flags: result.flags || [],
    model: MODELS.SIEVE,
  };
}
