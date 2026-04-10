import { openrouter, MODELS } from "./openrouter";

/**
 * Gate Tier 2: AI Qualitative Analysis
 * 
 * Uses Claude Sonnet via OpenRouter for structured tag extraction.
 * Extracts CAP/REL/FELT tags, scores specificity/counterfactual/relational.
 */

export interface QualifierResult {
  passed: boolean;
  cap_tags: string[];  // Capabilities guardrails
  rel_tags: string[];  // Relational ethics
  felt_tags: string[]; // Somatic/felt cues
  specificity: number;    // 0-10
  counterfactual: number; // 0-10
  relational: number;     // 0-10
  summary: string;
  model: string;
}

const QUALIFIER_PROMPT = `You are the AI Qualitative Analyzer for The Witness Protocol Foundation.

You have received an essay that passed the initial quality sieve. Your role: perform structured semantic analysis to extract alignment-relevant signal.

EXTRACT THE FOLLOWING:

1. CAP TAGS (Capabilities Guardrails): Themes about what AI/technology should NOT do, boundaries the witness would set, limits of acceptable capability.
   Examples: "autonomy_limits", "deception_prohibition", "consent_requirement", "human_override", "transparency_mandate"

2. REL TAGS (Relational Ethics): Themes about how humans relate to each other and to AI — trust, dependency, obligation, care.
   Examples: "trust_erosion", "dependency_risk", "obligation_to_future", "care_as_currency", "solidarity_across_difference"

3. FELT TAGS (Somatic/Felt Cues): Emotional and embodied experiences the witness describes — fear, grief, resolve, doubt, embodied knowing.
   Examples: "moral_vertigo", "grief_for_agency", "resolve_under_pressure", "embodied_knowing", "cognitive_dissonance"

SCORE THE FOLLOWING (0-10 each):
- SPECIFICITY: How concrete and detailed is the testimony? (10 = vivid scenario with names, dates, consequences; 0 = pure abstraction)
- COUNTERFACTUAL: Does the witness explore what-if scenarios? Do they interrogate alternative choices? (10 = deep counterfactual reasoning; 0 = none)
- RELATIONAL: Does the witness situate their ethics in relationship to others? (10 = deeply relational; 0 = purely individualistic)

PASS THRESHOLD: At least 2 tags extracted across all categories AND average score >= 5.0.

Respond ONLY with valid JSON:
{
  "passed": boolean,
  "cap_tags": ["tag1", "tag2"],
  "rel_tags": ["tag1"],
  "felt_tags": ["tag1", "tag2"],
  "specificity": number,
  "counterfactual": number,
  "relational": number,
  "summary": "2-3 sentence analysis of the testimony's alignment relevance"
}`;

export async function runQualifier(essayText: string): Promise<QualifierResult> {
  const response = await openrouter.chat.completions.create({
    model: MODELS.QUALIFIER,
    messages: [
      { role: "system", content: QUALIFIER_PROMPT },
      { role: "user", content: `TESTIMONY TEXT:\n\n${essayText}` },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI Qualifier");
  }

  const result = JSON.parse(content);
  return {
    passed: result.passed,
    cap_tags: result.cap_tags || [],
    rel_tags: result.rel_tags || [],
    felt_tags: result.felt_tags || [],
    specificity: result.specificity,
    counterfactual: result.counterfactual,
    relational: result.relational,
    summary: result.summary,
    model: MODELS.QUALIFIER,
  };
}
