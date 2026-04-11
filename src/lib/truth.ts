/**
 * The Witness Protocol Foundation — Operational Truth Manifest
 * ════════════════════════════════════════════════════════════
 *
 * This file contains the canonical operational facts for the platform.
 * It is not marketing copy. It represents the strict boundaries and 
 * current capabilities of the live software. Tests use this file to 
 * verify that documentation and claims align with reality.
 */

export const TWP_TRUTH = {
  // Meta
  currentVersion: "0.5.0",
  phaseLabel: "Phase 5 Alpha",
  
  // Posture
  reviewMode: "single_reviewer_alpha",
  testingPosture: "vitest_live_playwright_planned",
  privacyPosture: "regex_pre_llm_isolation_post_gate",
  
  // Public Claims Control
  forbiddenPhrases: [
    "pre-alpha",
    "no account creation",
    "blind dual-rater",
    "acceptance of the MHS is required before proceeding to The Gate",
    "Instrument is not yet connected",
    "3.6", // Stale rubric threshold
    "six dimensions using a 1-5 scale" // Stale rubric
  ],
  
  // Operational markers expected in documents
  semanticMarkers: {
    governanceAlpha: ["single reviewer", "alpha review", "dual-rater not yet operational"],
    testingLive: ["vitest is initialized", "vitest is live"],
  }
};
