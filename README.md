# The Witness Protocol Foundation Platform

The core infrastructure for gathering, analyzing, and safeguarding human moral and relational testimony in the face of transformative AI.

**Live Site:** [https://thewprotocol.online](https://thewprotocol.online)

## Current Status: Phase 5 · Alpha (Live)

The platform is currently **live** and actively used for testimony input and annotation.

### Completed Infrastructure (Phases 1-4, 6)
- **Global Production Deployment** (Vercel)
- **The Gate (3-Tier Vetting)**: AI Sieve (Claude) → AI Qualitative → Human Review (Admin)
- **The Inquisitor**: Structured dialogue engine for testimony extraction
- **God Mode Admin Portal**: Dashboard, gate queue, and manual CAP/REL/FELT annotation interface
- **Strict PII De-identification**: Data segmented before analysis
- **Auth & Notifications**: Supabase magic links, Resend automated emails, Sentry monitoring

### In Development (Phase 5)
- **Constitutional Mirror**: Cross-reference engine to detect anomalies and consensus across the corpus.
- **Icarus Synthesis Engine**: Distilled thought generation based on accumulated witness alignments.

## Engineering Guidelines
See `AGENTS.md` for AI coding agent constraints, design aesthetic protocols, privacy invariants, and stack details (Next.js 16, Supabase, Tailwind v4).
