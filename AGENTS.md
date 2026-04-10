# AGENTS.md — The Witness Protocol Foundation Platform

> Coding standards, project context, and constraints for AI coding agents working on this codebase.

---

## Project Identity

**Name:** The Witness Protocol Foundation Platform  
**Type:** Non-profit research infrastructure (NOT a commercial product)  
**Stage:** Phase 5 · Alpha (Live on Vercel)  
**Legal Entity:** Stichting The Witness Protocol Foundation (Dutch foundation)

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.x |
| Runtime | React | 19.x |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | 1.x |
| Database | Supabase (PostgreSQL) | latest |
| ORM | Drizzle ORM | latest |
| Auth | Supabase Auth | latest |
| AI/LLM | OpenRouter API | latest |
| AI Models | anthropic/claude-3.5-sonnet, anthropic/claude-3-haiku (via OpenRouter) | latest |
| Email | Resend | latest |
| Testing | Vitest (unit), Playwright (E2E) | latest |
| Monitoring | Sentry | latest |

---

## Critical Rules

### 1. Next.js 16 — READ THE DOCS FIRST
This version has breaking changes from your training data. Before writing any code:
- Read `node_modules/next/dist/docs/` for current API conventions
- Do NOT use deprecated patterns (Pages Router, `getServerSideProps`, etc.)
- Use App Router exclusively
- Default to Server Components; use `"use client"` only when required

### 2. Design Language — SOBER, NOT EXCITING
The Foundation's aesthetic is **stark minimalism signaling gravity**:
- Background: `#050505` (near-black)
- Text: `#E0E0E0` (off-white), `#808080` (muted)
- Borders: `#1F1F1F` (dark grey)
- Fonts: EB Garamond (body), Cinzel (headings)
- Motion: Slow fades only (1–2s). No bounce, spring, or micro-animations
- **NO** gradients, rounded corners, accent colors, or "tech" imagery
- **NO** gamification (points, badges, streaks, levels)
- **NO** marketing language ("amazing", "revolutionary", "breakthrough")
- Register is **documentation**, not promotional

### 3. Privacy — CONSTITUTIONAL CONSTRAINT
- Never send raw PII to the Claude API for dialogue or analysis
- PII detection runs in isolated functions with the sole purpose of stripping identifiers
- All PII stored encrypted in separate tables from research-facing data
- Contributor identity is never re-linked to testimony for research access
- Consent revocation must cascade to all linked records

### 4. Auditability — EVERY STATE CHANGE IS LOGGED
- All mutations must write to the `audit_log` table
- Audit entries include: action, actor_id, target_type, target_id, metadata, timestamp
- Audit log is append-only — no updates, no deletes, ever

### 5. Stage Clarity — ALWAYS HONEST
- Every public-facing page must state "Pre-alpha" status
- Never imply the system is complete, deployed, or proven
- The Failure Log is public — bugs and flaws are published, not hidden

---

## Code Conventions

### File Organization
- Pages in `src/app/` following Next.js App Router conventions
- Reusable UI components in `src/components/ui/`
- Domain components in `src/components/protocol/`
- Database operations in `src/lib/db/`
- AI/LLM operations in `src/lib/ai/`
- Utility functions in `src/lib/utils/`
- Type definitions in `src/types/`

### Naming
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase`
- Functions: `camelCase`
- Database tables: `snake_case`
- Database columns: `snake_case`
- Environment variables: `SCREAMING_SNAKE_CASE`
- CSS classes: Tailwind utility classes (no custom class names except in `globals.css`)

### Component Patterns
```tsx
// Server Component (default)
export default async function PageName() {
  const data = await fetchData();
  return <div>{/* Render */}</div>;
}

// Client Component (only when needed)
"use client";
export function InteractiveWidget() {
  const [state, setState] = useState();
  return <div>{/* Interactive */}</div>;
}
```

### API Route Patterns
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 1. Validate input (Zod)
  // 2. Check auth (Supabase JWT)
  // 3. Perform operation
  // 4. Log to audit_log
  // 5. Return response
}
```

### Database Access Pattern
```typescript
// Always use Drizzle ORM
import { db } from '@/lib/db';
import { witnessProfiles } from '@/lib/db/schema';

const profiles = await db.select().from(witnessProfiles).where(/* ... */);
```

---

## Environment Variables

```bash
# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_DB_URL=postgresql://postgres:...

OPENROUTER_API_KEY=sk-or-v1-...

RESEND_API_KEY=re_...

SENTRY_DSN=https://...

# Optional (Phase 4+)
DIGISTAMP_USERNAME=
DIGISTAMP_PASSWORD=
PINATA_API_KEY=
PINATA_SECRET_KEY=
```

---

## Testing Requirements

- Unit tests in `__tests__/` directories alongside source files
- E2E tests in `tests/e2e/` directory
- Minimum 85% coverage on `lib/` modules
- All CI runs must pass before merge
- Test database uses Supabase local development instance

---

## Common Gotchas

1. **Tailwind v4 uses `@theme` blocks** in CSS for design tokens, not `tailwind.config.js`
2. **Supabase client must be instantiated differently** for server (SSR) vs client contexts
3. **Drizzle ORM migrations** are generated, reviewed, then pushed — never auto-applied
4. **Claude API calls must never include PII** — strip first, then analyze
5. **The Inquisitor's 70/30 ratio** is enforced by a state machine, not by the LLM prompt alone
6. **Inter-rater agreement (Cohen's κ)** must be calculated using the specific formula in `/lib/utils/kappa.ts`, not approximated
