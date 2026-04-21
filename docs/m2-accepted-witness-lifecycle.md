# Milestone 2 Accepted-Witness Lifecycle

## Purpose

This note freezes the accepted-witness control-plane lifecycle for Milestone 2 before code changes land.

Boundary:

- `TWP` remains the control plane.
- `G_5.2` remains the source of truth for governed Witness runtime state and artifacts.
- This note defines `TWP` lifecycle and operator status only.
- This note does not move runtime persistence back into `TWP`.

## Storage Discipline

- `witness_submissions.submission_status` remains the Gate/HCC decision surface.
- `witness_profiles.status` remains the broad witness-account surface.
- `witness_runtime_links` remains the minimal accepted-witness bridge linkage surface in `TWP`.
- `failed` is an operator-visible bridge-error condition, not the durable source-of-truth runtime state.

## Frozen Milestone 2 Lifecycle

| Operator lifecycle | TWP linkage meaning | Trigger into state | Expected TWP status effect | Expected audit effect |
| --- | --- | --- | --- | --- |
| `accepted` | HCC accepted the witness, but invite/access release is not yet confirmed | Tier 3 accept succeeds | `access_status = accepted`, `bridge_status = pending`, `runtime_consent_status = unknown`, `last_bridge_error = null` | existing `gate.tier3.accept`; add explicit accepted-witness lifecycle audit in M2 |
| `invited` | TWP has issued/confirmed the access release for the governed Witness path | invite notification/unlock succeeds after acceptance | `access_status = invited`, bridge/consent state unchanged unless bridge work also occurs | add invite/lifecycle audit in M2 |
| `active` | Witness has successfully entered the governed path or already has a governed session | successful bootstrap, consent grant, or governed turn with valid access | `access_status = active`; `bridge_status = ready|active`; `runtime_consent_status` reflects runtime mirror; clear `last_bridge_error` on success | existing `witness.bridge.bootstrap`, `witness.bridge.consent_granted`, `witness.bridge.turn`; add explicit lifecycle activation audit only on first transition |
| `completed` | Witness runtime reached a governed terminal state that TWP mirrors for operators | latest governed testimony is terminal for the alpha flow | `access_status = completed`; preserve latest bridge/consent mirror and sync timestamp | add lifecycle completion audit in M2 |
| `failed` | Operator-visible bridge failure state; retry/recovery needed | bridge request fails or runtime status sync fails | keep underlying `access_status` (`accepted|invited|active|completed`) and set `bridge_status = error`; persist `last_bridge_error`; do not overload revoked/config/auth with a fake success state | add explicit bridge failure audit in M2 with retryability/classification metadata |
| `revoked` | Control-plane access has been intentionally disabled in `TWP` | operator revoke/disable action | `access_status = revoked`; future instrument entry/turn paths fail closed; existing governed artifacts remain in `G_5.2` | add lifecycle revoke audit in M2 |

## Completed-State Mirror Rule

For Milestone 2, `TWP` should treat governed testimony state as the completion signal instead of inventing a second runtime completion system.

Initial rule:

- governed testimony `state = sealed` => `TWP` lifecycle `completed`

Non-terminal governed testimony states remain operator-visible runtime detail, not completion:

- `captured`
- `retained`
- `synthesized`

Revocation remains a `TWP` control-plane decision, not a rewrite of governed artifacts.

## Failure Classification Rule

`failed` is a derived operator state, not a replacement for access control.

Interpretation:

- retryable bridge/runtime failure => keep access state, set `bridge_status = error`
- config/auth failure => keep access state, set `bridge_status = error`, preserve explicit error classification
- revoked/disabled => `access_status = revoked`, not merely `bridge_status = error`

## Implementation Rule For Milestone 2

Before introducing or renaming lifecycle states in code:

1. this note must exist
2. route and UI changes must follow this table
3. any new `G_5.2` need must be named as an exact seam and smallest patch
