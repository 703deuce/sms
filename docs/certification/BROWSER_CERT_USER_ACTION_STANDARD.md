# Browser Certification — User-Action Acceptance Standard

**Authority:** Product certification requirements (Appointments + MCTB V1)  
**Applies to:** `scripts/browser-cert/**`, `npm run cert:appointments-mctb-browser`  
**Related:** `docs/certification/BROWSER_FLOW_CLASSIFICATION_AUDIT.md`, `docs/certification/BROWSER_CERT_STABILITY.md`

## Purpose

Browser certification must prove that **real customers can use the product through the frontend** — not merely that routes return 200, controls exist, APIs respond, or backend unit tests pass.

## Two tiers (both required for customer-operable features)

| Tier | Batch prefix | What it proves | Sufficient alone? |
|------|--------------|----------------|-------------------|
| **Reachability** | `BATCH-01` … `BATCH-14` | Page loads, shell, redirect, error state, light nav | **No** for operable features |
| **User-action** | `BATCH-UA` (`UA-*`) | Full click/type/save/reload/persist journey | **Yes** (with reachability) |

Route/render checks are **kept**. They are the first gate. They are **not** the final PASS for anything a customer can operate.

## Required interaction standard

For each **customer-operable** feature, the browser must perform the same sequence a real user would perform in production:

1. Open the actual customer-facing page.
2. Navigate there through the UI where appropriate (not only direct URL when nav is the feature).
3. Click the real button/control.
4. Type/select values into the real form fields.
5. Submit/save through the frontend.
6. Wait for the real UI response (success or actionable error).
7. Verify success/error state in the UI.
8. Navigate away or refresh.
9. Reopen the page.
10. Verify the resulting state persisted.
11. Where applicable, verify the downstream effect from another frontend page.

### PASS definition

A customer-operable feature **only passes** when:

- Its **reachability** flow PASSes, **and**
- Its **user-action** flow PASSes (browser performed the actual user action; frontend state matches expected persisted/runtime result).

Route availability alone is **not** sufficient.

### FAIL / BLOCKED

- **FAIL** — user-action sequence ran and UI/runtime did not match expectation.
- **BLOCKED — LIVE PSTN / LIVE EXTERNAL PROVIDER / LIVE MEDIA** — provider-live step excluded; customer-operable frontend path must still be exercised where possible.
- **NOT IMPLEMENTED** — feature not in V1 scope.

## Fixture rule

Fixtures/API setup may prepare **prerequisite state** when the prerequisite is **not** the feature under test.

| OK | Not OK |
|----|--------|
| Fixture appointment when testing **Cancel appointment** | Fixture appointment when testing **Create appointment** |
| Seed workspace/types before public booking | API-create booking type when testing **Create booking type** UI |
| Backend cert for PSTN send; UI cert for reminder **settings** | Mark PASS because backend script passed without browser |

**The action being certified must be performed through the frontend.**

## Classification vocabulary

| Label | Meaning |
|-------|---------|
| `TRUE_USER_ACTION` | Full standard above |
| `ROUTE_RENDER` | Load, redirect, shell, control-exists, light interaction without save/persist |
| `BACKEND_STATIC` | No browser; script/backend matrix only |

Audit: `npm run cert:audit-browser-flow-classification`

## Examples (reference flows)

### Appointments — create

`UA-APT-05-create`: Open Appointments → New Appointment → select type → slot → customer fields → Create → verify success → open detail → refresh → verify persists.

### Appointments — edit / cancel

- `UA-APT-07-edit`: Open appointment → edit field → Save → refresh → verify.
- `UA-APT-09-cancel`: Open appointment → Cancel → confirm → verify list/calendar → refresh.

### Booking type / availability / reminders

- `UA-APT-11-types`: Create type → save → reload → verify name.
- `UA-APT-16-availability`: Change hours → save → reload → verify values.
- `UA-APT-33-reminders`: Edit template/timing → save → reload.

### AI Notetaker

- `UA-APT-50-notetaker`: Settings → change option → save → refresh → verify (provider-live join may remain blocked).

### MCTB setup

- `UA-MCTB-05-phone`: Phone & Forwarding → fill business line → save → reload.
- `UA-MCTB-07-consent`: Consent mode + attestation → save → reload.
- `UA-MCTB-12-textback`: Edit opener → save → reload.
- `UA-MCTB-41-notifications`: Mode + recipient → save → reload.

### Public flows

- `UA-APT-13-public-book`: `/book/{slug}` → complete booking through public UI → confirmation state.

## Running certification

```bash
# Reachability + user-action (all flows)
CERT_BROWSER_PASSWORD='...' npm run cert:appointments-mctb-browser -- --fresh

# User-action batch only
CERT_BROWSER_PASSWORD='...' npm run cert:appointments-mctb-browser -- --only BATCH-UA

# Single user-action flow
CERT_BROWSER_PASSWORD='...' npm run cert:appointments-mctb-browser -- --flow UA-APT-05-create

# Classification audit (no browser)
npm run cert:audit-browser-flow-classification
```

## Implementation status

- **189 baseline flows:** classified in `scripts/browser-cert/flow-classification.ts`
- **BATCH-UA:** initial user-action flows in `scripts/browser-cert/behavioral-flows.ts` (expand until all `needsUserActionFlow` features have UA coverage)
- **Final certification:** not complete until audit shows zero missing UA flows for customer-operable features (or explicit BLOCKED/DEFERRED)
