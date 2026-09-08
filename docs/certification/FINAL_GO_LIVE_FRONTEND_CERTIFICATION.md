# Transovo Final Go-Live Frontend Certification

**Authority:** Product acceptance standard for Appointments + MCTB V1 launch  
**Machine manifest:** `scripts/browser-cert/cert-groups/manifest.ts` (139 cert groups)  
**Runners:** `scripts/browser-cert/cert-groups/runners/`  
**Interaction standard:** `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md`

## Core rule

> If Cursor marks a sequence **PASS**, you must be able to open the live site, perform the **same sequence through the frontend**, and get the **same result**.

Not: code exists · page loads · API 200 · unit test pass.

Every testable cert group must prove:

`open page → click/control → validation → save/submit → runtime behavior → persistence → refresh/reopen → resulting UI state`

(Plus downstream/cross-page proof where applicable.)

## Excluded (mark separately — never false PASS)

| Category | Status label |
|----------|----------------|
| Login/sign-up/auth flows | Out of cert scope |
| Subscription billing / real card charges | Out of cert scope |
| Actual PSTN phone calls | `BLOCKED — LIVE PSTN` |
| Live camera/mic media quality | `BLOCKED — LIVE MEDIA` |
| Live Zoom/Teams bot / OAuth where unsafe | `BLOCKED — LIVE EXTERNAL PROVIDER` |
| Features not in V1 | `NOT IMPLEMENTED` or `INTENTIONALLY DEFERRED` |

## Cert group inventory (139)

| Product | IDs | Batch flag |
|---------|-----|------------|
| Appointments | `APT-01` … `APT-69` | `CERT-APT` |
| MCTB | `MCTB-01` … `MCTB-58` | `CERT-MCTB` |
| Cross-product | `CROSS-01` … `CROSS-08` | `CERT-CROSS` |
| Global passes | `GLOBAL-01` … `GLOBAL-04` | `CERT-GLOBAL` |

Each group maps 1:1 to the acceptance sequences in the product certification plan (navigation, create appointment, MCTB handoff, public booking, etc.).

**Supplementary reachability flows** (59) remain for route/shell checks where they do not duplicate a cert group id.

## Execution model

Run **one cert group at a time** (one browser session per group, up to 10 min timeout):

1. Real frontend on preview/production URL  
2. Click real controls — no source-only inspection  
3. Save/create/update through customer path  
4. Confirm UI success/error  
5. Reload / reopen  
6. Confirm persistence  
7. Cross-page proof when required  
8. On failure: fix → retest **only that group** → checkpoint → continue  

```bash
export CERT_BROWSER_PASSWORD='...'

# Single cert group (recommended)
npm run cert:appointments-mctb-browser -- --cert APT-05

# Product batch
npm run cert:appointments-mctb-browser -- --only CERT-APT
npm run cert:appointments-mctb-browser -- --only CERT-MCTB

# Full suite (reachability + all cert groups)
npm run cert:appointments-mctb-browser -- --fresh

# Audit / inventory
npm run cert:audit-browser-flow-classification
```

## Final report vocabulary

Every cert ID must appear in results with one of:

- `PASS`
- `FAIL`
- `BLOCKED — LIVE PSTN`
- `BLOCKED — LIVE MEDIA`
- `BLOCKED — LIVE EXTERNAL PROVIDER`
- `NOT IMPLEMENTED`
- `INTENTIONALLY DEFERRED`

No unexplained FAIL. No silent omission.

## Go-live gate

Frontend certification is complete when **every locally/browser-testable cert group** is `PASS`, and every excluded item is explicitly `BLOCKED` / `NOT IMPLEMENTED` / `DEFERRED` — not route-only PASS.

State file: `docs/certification/appointments-mctb-browser-cert-state.json`

## Detailed sequence specs

The full per-group test steps (every sub-action for APT-05 booking types, MCTB-47 cross-product booking, etc.) are defined in the product certification plan provided to engineering. Implementations live in:

- `scripts/browser-cert/cert-groups/runners/appointments.ts`
- `scripts/browser-cert/cert-groups/runners/mctb.ts`
- `scripts/browser-cert/cert-groups/runners/cross.ts`
- `scripts/browser-cert/cert-groups/runners/global.ts`

Groups with dedicated runners implement the primary user journey; expand runners iteratively until every sub-step in the plan is covered. Groups marked `blocked` in the manifest never auto-PASS.
