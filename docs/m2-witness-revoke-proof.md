# Milestone 2 Accepted-Witness Proof

## Purpose

Re-run the Milestone 2 accepted-witness proof after lifecycle, revoke, and bridge-error handling changes in `TWP`.

Boundary:

- `TWP` is still the control plane
- `G_5.2` is still the governed runtime and artifact plane
- the proof must not repopulate legacy `TWP` dialogue tables

## Local startup

### 1. Start `G_5.2`

From `../G_5.2`:

```powershell
$env:DASHBOARD_PORT='5100'
pnpm dashboard
```

### 2. Start `TWP`

From `./TWP/platform` with bridge env pointing at `http://127.0.0.1:5100`:

```powershell
npx next dev -p 5010 -H 127.0.0.1
```

## Proof steps

1. Pick an accepted witness in `TWP` with a valid `witnessId`.
2. Ensure the witness has a minimal `witness_runtime_links` row in `TWP`.
3. Confirm the witness is in an operator-releasable state such as `invited`.
4. Open `/instrument` or call the bootstrap route once.
5. Confirm the witness becomes `active`.
6. Run the admin revoke/disable action.
7. Re-open `/instrument`.
8. Re-run bootstrap and one turn attempt.

## Expected evidence

### Happy path

- `audit_log` shows `witness.lifecycle.active`
- `witness_runtime_links.access_status = active`
- if the local witness already has governed `G_5.2` testimony, the active transition may appear on bootstrap rather than on a brand-new first turn

### Revoke path

- admin revoke sets `witness_runtime_links.access_status = revoked`
- `audit_log` shows `witness.lifecycle.revoked`

### Post-revoke blocked entry / turn

- `/instrument` renders the blocked state
- bootstrap returns `403`
- turn returns `403`

### Legacy `TWP` tables remain untouched

- `TWP.inquisitor_sessions = 0`
- `TWP.inquisitor_turns = 0`

### Governed `G_5.2` artifacts remain intact

- the governed session file still exists
- the governed testimony file still exists
- blocked post-revoke attempts do not rewrite those files

## Reported local artifact

The reported local proof result for this milestone is:

- `_proof-logs/m2-revoke-proof.json`

That artifact recorded:

- active transition observed
- revoke event observed
- blocked post-revoke entry/bootstrap/turn
- untouched legacy `TWP` dialogue tables
- unchanged governed `G_5.2` session/testimony hashes after blocked attempts
