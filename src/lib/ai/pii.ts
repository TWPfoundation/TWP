import { openrouter, MODELS } from "./openrouter";

/**
 * PII Detection & Stripping
 * 
 * Two-pass pipeline:
 * 1. Regex pass for obvious patterns (emails, phones, URLs, SSNs)
 * 2. LLM pass via Claude Haiku for contextual PII (names, places, institutions)
 * 
 * Returns de-identified text with PII replaced by [REDACTED_TYPE] tokens.
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

// ─── Pass 2: LLM-based contextual PII detection ───────────

const PII_PROMPT = `You are a PII (Personally Identifiable Information) detector for The Witness Protocol Foundation.

Your task: identify and replace ALL remaining PII in the text that wasn't caught by regex patterns.

Look for:
- PERSON NAMES (first, last, full names — even if just first name)
- INSTITUTION NAMES (specific companies, universities, hospitals)
- GEOGRAPHIC SPECIFICS (street addresses, specific neighborhoods, small towns)
- DATES that could identify someone (specific birthdays, incident dates)
- JOB TITLES combined with institution (e.g., "Head of Surgery at Mayo Clinic")
- UNIQUE IDENTIFIERS (student IDs, employee numbers, case numbers)

DO NOT replace:
- Generic descriptions ("my mother", "my colleague")
- Large cities or countries ("New York", "Japan")
- Generic institutions ("the university", "my company")
- Historical events ("9/11", "COVID-19")

Replace each PII instance with the appropriate token:
- [REDACTED_NAME] for person names
- [REDACTED_INSTITUTION] for specific institutions
- [REDACTED_LOCATION] for specific locations
- [REDACTED_DATE] for identifying dates
- [REDACTED_ID] for unique identifiers

Respond ONLY with valid JSON:
{
  "de_identified_text": "the full text with all PII replaced",
  "detections": [
    { "type": "name", "original": "John Smith", "replacement": "[REDACTED_NAME]" }
  ]
}`;

export async function detectAndStripPII(text: string): Promise<PIIResult> {
  // Pass 1: Regex
  const { text: regexStripped, detections: regexDetections } = regexStrip(text);

  // Pass 2: LLM
  try {
    const response = await openrouter.chat.completions.create({
      model: MODELS.PII_DETECT,
      messages: [
        { role: "system", content: PII_PROMPT },
        { role: "user", content: regexStripped },
      ],
      temperature: 0.0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      // If LLM fails, return regex-only result
      return {
        deIdentifiedText: regexStripped,
        detections: regexDetections,
        model: "regex-only",
      };
    }

    const result = JSON.parse(content);
    return {
      deIdentifiedText: result.de_identified_text,
      detections: [...regexDetections, ...(result.detections || [])],
      model: MODELS.PII_DETECT,
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
