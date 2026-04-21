# Milestone 1 Witness Bridge Contract

## Ownership

- `TWP` is the control plane.
- `G_5.2` is the governed Witness runtime.
- `TWP` creates `witnessId` first and keeps only minimal linkage state.
- `G_5.2` remains the system of record for Witness runtime consent, sessions, turns, testimony, synthesis, annotation, archive candidates, and publication artifacts.

## First-Slice Scope

- Bridge only accepted witnesses.
- Route accepted-witness dialogue through `G_5.2`.
- Do not route `P-E-S` through this bridge.
- Do not duplicate dialogue turns or testimony bodies into `TWP`.

## Transport

- Direct synchronous REST over a local service boundary.
- All `G_5.2` calls must go through one `TWP` bridge client module.
- `TWP` fails closed if bridge config is missing.

## Proposed Internal Auth Contract

- Header: `X-TWP-Bridge-Key: <shared-secret>`
- Header: `X-TWP-Bridge-Caller: twp-control-plane`
- `TWP` sends both headers on every bridge request.

## Current Verified G_5.2 Surface

- `POST /api/inquiry/turn`
  - Body: `{ product: "witness", witnessId, sessionId?, mode?, userMessage }`
- `GET /api/inquiry/sessions/:id?product=witness`
- `GET /api/witness/consent?witnessId=...`
- `POST /api/witness/consent`
- `GET /api/witness/testimony?witnessId=...`

## Exact Verified Gap

- `G_5.2/apps/dashboard/src/server.ts` currently exposes the Witness HTTP surface without bridge-auth enforcement.
- `TWP` can send the shared-secret headers now, but `G_5.2` does not currently validate them.
- Smallest required `G_5.2` patch:
  - add one request guard in `apps/dashboard/src/server.ts`
  - enforce the shared secret only for bridge-exposed Witness endpoints
  - return `401` or `403` with stable JSON when missing or invalid

## TWP Minimal Linkage State

`TWP` keeps only:

- `witnessId`
- auth mapping through `witness_profiles.supabase_user_id`
- access status
- high-level runtime consent mirror
- bridge sync status and last bridge error

`TWP` must not store:

- full dialogue turns
- testimony bodies
- annotation bodies
- publication artifacts
