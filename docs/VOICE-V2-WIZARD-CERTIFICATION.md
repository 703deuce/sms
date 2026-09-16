# Voice V2 wizard UI certification

**Date:** 2026-09-16T13:03:49.888Z
**Agent:** `cmshz2lc25c622c4i58303501`
**Health SHA:** b40e8bc58a43a8e04856696c05be624f9cf8f68a
**Result:** FAIL

## Test agent

- Phone last 4: 3615
- Published version (before): `cmu43a4ov3k0w2j1l0n1d4d20`
- Published version (after): `cmu43a4ov3k0w2j1l0n1d4d20`

## Page summary

| Page | PASS | FAIL | BLOCKED | N/A |
|------|------|------|---------|-----|
| Purpose | 2 | 2 | 0 | 0 | (FAIL) |
| Phone | 4 | 0 | 0 | 0 | (PASS) |
| Business Knowledge | 2 | 0 | 1 | 1 | (PASS) |
| Booking | 3 | 0 | 1 | 1 | (PASS) |
| Call Handling | 2 | 0 | 0 | 0 | (PASS) |
| Voice | 2 | 0 | 0 | 0 | (PASS) |
| Test | 2 | 0 | 0 | 0 | (PASS) |
| Activate | 2 | 0 | 0 | 0 | (PASS) |

## Control matrix

| Page | Section | Label | Type | Status | Note |
|------|---------|-------|------|--------|------|
| Global | inventory | Control inventory count |  | PASS | 27 controls catalogued in scripts/wizard-control-inventory.json |
| Purpose | nav | Purpose | step | PASS |  |
| Phone | nav | Phone | step | PASS |  |
| Business Knowledge | nav | Business Knowledge | step | PASS |  |
| Booking | nav | Booking | step | PASS |  |
| Call Handling | nav | Call Handling | step | PASS |  |
| Voice | nav | Voice | step | PASS |  |
| Test | nav | Test | step | PASS |  |
| Activate | nav | Activate | step | PASS |  |
| Purpose | Identity | Agent name | text | FAIL |  |
| Purpose |  | Agent name refresh |  | FAIL |  |
| Business Knowledge |  | Business name |  | BLOCKED | #business-name not found |
| Cross-page | stale-save | UI: Booking → REQUEST_ONLY |  | PASS | was REQUEST_ONLY → REQUEST_ONLY |
| Cross-page | stale-save | Information save preserves Booking strategy |  | PASS | after info save: REQUEST_ONLY |
| Booking |  | Add caller field |  | BLOCKED | #new-collect-field not visible |
| Booking | draft-publish | Draft REQUEST_ONLY before publish |  | PASS |  |
| Phone | load | Step renders |  | PASS |  |
| Phone | routing | Assigned phone / inbound mode |  | PASS | …3615 mode=VOICE_AGENT |
| Business Knowledge |  | Long-term memory toggle |  | NOT_APPLICABLE | switch not on page |
| Purpose | load | Step renders without error banner |  | PASS |  |
| Phone | load | Step renders without error banner |  | PASS |  |
| Business Knowledge | load | Step renders without error banner |  | PASS |  |
| Booking | load | Step renders without error banner |  | PASS |  |
| Call Handling | load | Step renders without error banner |  | PASS |  |
| Voice | load | Step renders without error banner |  | PASS |  |
| Test | load | Step renders without error banner |  | PASS |  |
| Activate | load | Step renders without error banner |  | PASS |  |
| Booking | runtime | Tool eligibility vs strategy |  | NOT_APPLICABLE | strategy=REQUEST_ONLY tools= |

## Cross-page / special tests

- Stale save: see Cross-page rows above
- Custom field: see Booking intake rows
- Draft vs publish: partial (full publish cycle optional — no PSTN)

### Failures
- Purpose agent name not persisted after UI save
- Purpose agent name lost on refresh
- Custom field UI blocked — mandatory test incomplete

Inventory source: `scripts/wizard-control-inventory.json` (27 controls).

Artifacts: `/opt/cursor/artifacts/voice-v2-wizard-cert/`