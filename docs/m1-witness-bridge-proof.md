# Milestone 1 Local Proof Run

## Goal

Prove one accepted-witness journey from `TWP` into `G_5.2`:

1. accepted witness exists in `TWP`
2. `witnessId` is the `witness_profiles.id`
3. `TWP` bridge calls reach `G_5.2`
4. runtime consent is granted in `G_5.2`
5. one governed witness turn succeeds
6. runtime testimony/session state lands only in `G_5.2`

## Local Startup

### 1. Start G_5.2 on a non-conflicting port

From `../G_5.2`:

```powershell
$env:DASHBOARD_PORT='5100'
pnpm dashboard
```

Expected runtime base URL:

```text
http://127.0.0.1:5100
```

### 2. Configure TWP bridge env

In `TWP/.env.local`:

```text
G52_WITNESS_BRIDGE_BASE_URL=http://127.0.0.1:5100
G52_WITNESS_BRIDGE_SHARED_SECRET=<same-local-secret-you-plan-to-enforce-in-G_5.2>
```

### 3. Start TWP

From `./TWP/platform`:

```powershell
npm run dev
```

## Manual Proof Steps

1. Sign in as a witness in `TWP`.
2. Ensure the witness has an accepted `testimony_records` row with `status = annotating`.
3. Accept the witness through the HCC flow if needed.
4. Open `/instrument`.
5. Confirm the runtime shows `Consent Required` on first entry if `G_5.2` has no Witness consent yet.
6. Click `Grant Runtime Consent`.
7. Submit one witness message.
8. Confirm the response returns from `G_5.2` and the UI shows at least one governed round.
9. Confirm `TWP` stored only the minimal linkage row in `witness_runtime_links`.
10. Confirm the new session/testimony artifacts appear under `G_5.2/data/witness/`.

## TWP Checks

- `witness_profiles.id` is the bridge `witnessId`
- `witness_runtime_links` row exists for the accepted witness
- `audit_log` contains:
  - `witness.bridge.bootstrap`
  - `witness.bridge.consent_granted`
  - `witness.bridge.turn`

## G_5.2 Checks

- `data/witness/sessions/*.json` contains the governed session
- `data/witness/testimony/*.json` contains the governed testimony record
- no dialogue turns were inserted into `TWP.inquisitor_sessions` or `TWP.inquisitor_turns`

## Current Verified Friction

- `TWP` now sends a shared secret on every bridge request.
- `G_5.2` does not yet validate that shared secret.
- Exact minimal follow-up seam:
  - file: `G_5.2/apps/dashboard/src/server.ts`
  - add a request guard for the bridge-exposed Witness endpoints
  - reject missing/invalid bridge auth with stable JSON
