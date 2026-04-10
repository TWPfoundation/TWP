import { openrouter, MODELS } from "./openrouter";

/**
 * PII Detection & Stripping — Candidate Isolation Architecture
 * 
 * Two-pass pipeline designed so that FULL testimony text never
 * leaves the server for PII detection:
 * 
 * 1. Regex pass for obvious patterns (emails, phones, URLs, SSNs, IPs)
 * 2. Heuristic extraction of candidate PII tokens (capitalized phrases,
 *    proper noun patterns, location/institution indicators), then ONLY
 *    those isolated candidates are sent to Claude for classification.
 *    Claude never sees the full testimony context.
 * 3. Classified candidates are applied back to the original text locally.
 * 
 * This satisfies the constitutional privacy constraint: no raw testimony
 * is ever transmitted to a third party for PII detection.
 */

export interface PIIResult {
  deIdentifiedText: string;
  detections: PIIDetection[];
  model: string;
}

interface PIIDetection {
  type: string;
  original: string;
  replacement: string;
}

// ─── Pass 1: Regex-based PII stripping ─────────────────────

const PII_PATTERNS: { type: string; regex: RegExp; replacement: string }[] = [
  {
    type: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    type: "phone",
    regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    type: "url",
    regex: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    replacement: "[REDACTED_URL]",
  },
  {
    type: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[REDACTED_SSN]",
  },
  {
    type: "ip_address",
    regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: "[REDACTED_IP]",
  },
  {
    type: "date_specific",
    regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    replacement: "[REDACTED_DATE]",
  },
  {
    type: "date_numeric",
    regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    replacement: "[REDACTED_DATE]",
  },
];

function regexStrip(text: string): { text: string; detections: PIIDetection[] } {
  const detections: PIIDetection[] = [];
  let result = text;

  for (const pattern of PII_PATTERNS) {
    const matches = result.matchAll(pattern.regex);
    for (const match of matches) {
      detections.push({
        type: pattern.type,
        original: match[0],
        replacement: pattern.replacement,
      });
    }
    result = result.replaceAll(pattern.regex, pattern.replacement);
  }

  return { text: result, detections };
}

// ─── Pass 2: Candidate Isolation + LLM Classification ─────

/**
 * Heuristically extract candidate PII tokens from text.
 * These are substrings that MIGHT be personally identifying:
 * - Title-case multi-word sequences (likely proper nouns / names)
 * - Capitalized words following contextual prepositions
 *   ("at", "for", "from", "in", "near", "called")
 * - Quoted names
 * 
 * Returns deduplicated candidate strings WITHOUT surrounding context.
 */
function extractCandidates(text: string): string[] {
  const candidates = new Set<string>();

  // Title-case sequences of 2-4 words (likely person names, places, institutions)
  // e.g. "John David Smith", "Goldman Sachs", "Mayo Clinic"
  const titleCaseRegex = /\b(?:[A-Z][a-z]+(?:\s+(?:of|the|and|de|van|von|el|al|la)\s+)?){2,4}\b/g;
  for (const match of text.matchAll(titleCaseRegex)) {
    const candidate = match[0].trim();
    // Skip common false positives
    if (!isCommonPhrase(candidate) && candidate.length > 3) {
      candidates.add(candidate);
    }
  }

  // Contextual extraction: words after location/institution indicators
  // "at Goldman Sachs", "from MIT", "in Millville", "near Oak Street"
  const contextualRegex = /\b(?:at|for|from|in|near|called|named|works?\s+at|lives?\s+in|visited|attended)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/g;
  for (const match of text.matchAll(contextualRegex)) {
    const candidate = match[1]?.trim();
    if (candidate && !isCommonPhrase(candidate) && candidate.length > 2) {
      candidates.add(candidate);
    }
  }

  // Single capitalized words that appear mid-sentence (potential first names)
  // Match capitalized words NOT at the start of a sentence
  const midSentenceCapRegex = /(?<=[a-z.,;:]\s+)([A-Z][a-z]{2,})\b/g;
  for (const match of text.matchAll(midSentenceCapRegex)) {
    const candidate = match[1]?.trim();
    if (candidate && !isCommonWord(candidate) && candidate.length > 2) {
      candidates.add(candidate);
    }
  }

  return Array.from(candidates);
}

/** Common title-case phrases that are NOT PII */
const COMMON_PHRASES = new Set([
  "The Gate", "The Inquisitor", "The Witness", "The Protocol",
  "The Foundation", "The Archive", "Human Curation", "Curation Council",
  "United States", "United Kingdom", "United Nations",
  "New York", "New Zealand", "South Africa", "North America",
  "South America", "East Asia", "West Africa",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "World War", "Civil War", "Cold War",
  "Dear Sir", "Dear Madam",
]);

function isCommonPhrase(phrase: string): boolean {
  return COMMON_PHRASES.has(phrase);
}

/** Common capitalized words that appear mid-sentence but are not names */
const COMMON_WORDS = new Set([
  "I", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
  "Saturday", "Sunday", "God", "Christian", "Muslim", "Jewish",
  "Buddhist", "Hindu", "Catholic", "Protestant", "American",
  "European", "Asian", "African", "English", "Spanish", "French",
  "German", "Dutch", "Chinese", "Japanese", "Arabic", "Russian",
  "However", "Moreover", "Furthermore", "Therefore", "Nevertheless",
  "Perhaps", "Although", "Because", "Despite", "During",
]);

function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word);
}

const CLASSIFY_PROMPT = `You are a PII classifier. You will receive a JSON array of text fragments extracted from a document. For each fragment, classify whether it is personally identifiable information (PII) or not.

Classify each as one of:
- "name" — a person's name (first, last, or full)
- "institution" — a specific named company, university, hospital, etc.
- "location" — a specific street, small town, neighborhood, or address
- "id" — a unique identifier (employee number, case number, etc.)
- "not_pii" — not personally identifying (generic, well-known, or common)

IMPORTANT: Large cities (New York, London, Tokyo), countries, and well-known historical institutions are NOT PII. Only flag specific, identifying references.

Respond ONLY with valid JSON:
{
  "classifications": [
    { "text": "John Smith", "type": "name" },
    { "text": "Goldman Sachs", "type": "institution" },
    { "text": "Main Street", "type": "not_pii" }
  ]
}`;

const TYPE_TO_REPLACEMENT: Record<string, string> = {
  name: "[REDACTED_NAME]",
  institution: "[REDACTED_INSTITUTION]",
  location: "[REDACTED_LOCATION]",
  id: "[REDACTED_ID]",
};

export async function detectAndStripPII(text: string): Promise<PIIResult> {
  // Pass 1: Regex
  const { text: regexStripped, detections: regexDetections } = regexStrip(text);

  // Pass 2: Candidate Isolation + LLM Classification
  const candidates = extractCandidates(regexStripped);

  if (candidates.length === 0) {
    // No candidates found — regex-only result
    return {
      deIdentifiedText: regexStripped,
      detections: regexDetections,
      model: "regex-only",
    };
  }

  try {
    // Send ONLY the isolated candidate tokens — never the full text
    const response = await openrouter.chat.completions.create({
      model: MODELS.PII_DETECT,
      messages: [
        { role: "system", content: CLASSIFY_PROMPT },
        { role: "user", content: JSON.stringify(candidates) },
      ],
      temperature: 0.0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        deIdentifiedText: regexStripped,
        detections: regexDetections,
        model: "regex-only",
      };
    }

    // Strip markdown fences if present
    const cleaned = content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const result = JSON.parse(cleaned);
    const classifications: { text: string; type: string }[] = result.classifications || [];

    // Apply classifications back to the text
    let finalText = regexStripped;
    const llmDetections: PIIDetection[] = [];

    for (const cls of classifications) {
      if (cls.type === "not_pii") continue;
      const replacement = TYPE_TO_REPLACEMENT[cls.type];
      if (!replacement) continue;

      // Only replace if the candidate actually appears in the text
      if (finalText.includes(cls.text)) {
        finalText = finalText.replaceAll(cls.text, replacement);
        llmDetections.push({
          type: cls.type,
          original: cls.text,
          replacement,
        });
      }
    }

    return {
      deIdentifiedText: finalText,
      detections: [...regexDetections, ...llmDetections],
      model: `candidate-isolation:${MODELS.PII_DETECT}`,
    };
  } catch {
    // Graceful fallback to regex-only
    return {
      deIdentifiedText: regexStripped,
      detections: regexDetections,
      model: "regex-only-fallback",
    };
  }
}
