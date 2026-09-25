# MCTB Pass 5–6 — Owner handoff summary

Copy-friendly summary of analytics acceptance, Pass 6 reconciliation, and next steps.

---

## Pass 5 (analytics truthfulness)

Pass 5 is accepted as **truthful measurement**, not relabeling:

- Recovery texts sent use authoritative **`smsSentAt`**
- Booking links use **`BOOKING_LINK_SENT`** events (no `linksSent = textsSent` proxy)
- **Suppressed ≠ Failed** in funnel reporting
- Ranges use **workspace timezone**
- **No fake historical backfill** for booking links — analytics are accurate from when authoritative events exist

That matches the preference over a longer but untrustworthy history.

**Historical booking-link decision:** Do not backfill guesses. Analytics becoming accurate from the point that authoritative events exist is preferable to showing a longer history that isn’t trustworthy.

---

## Pass 6 — final reconciliation (Kirsten deliverable)

**Branch:** `cursor/mctb-pass-6-final-reconciliation-2304`  
**PR:** [#528](https://github.com/703deuce/sms/pull/528) (draft; related: #526 Pass 4, #527 Pass 5)

**Mode:** reconciliation only — no visual polish, no schema/TeXML/eligibility/SMS/AI runtime changes.

Passes 1 / 1B / 1C / 2 / 3 / 4 / 5 are accepted. This is NOT another feature-development pass.

### Requirement outcomes

| Requirement | Outcome |
|-------------|---------|
| **7 MCTB nav destinations** | Overview → Missed Calls → Inbox → **AI Recovery** → Voicemail → Analytics → Setup (`src/lib/products/mctb-nav.ts`) |
| **`/mctb/ai-recovery`** | Renders Pass 3 **`AiRecoverySettingsPage`** (Status, Business information, Information to collect, Booking link when entitled) — not legacy AI Lead Recovery product |
| **`/mctb/ai-lead-recovery`** | Redirect → `/mctb/ai-recovery` (query preserved); old presentation kept in repo, not nav-linked |
| **`/mctb/voice-agent`** | Redirect → **`/voice/agents`**; MCTB does not own Voice agent config; nav uses Voice canonical URL |
| **Product shell** | MCTB-only / Voice-only / both — product switcher; no giant combined sidebar |
| **Voicemail** | Operational `/mctb/voicemail` vs configuration `/mctb/setup/voicemail` |
| **Consent log** | `/mctb/compliance/consent` — contextual only (Setup → Consent → history; Missed Call Detail) |
| **Numbers** | `/mctb/numbers` → setup phone manage (`/mctb/setup/phone?open=manage` or equivalent) |
| **Legacy setup** | `business-hours`, `follow-up`, `missed-call-rules` → `/mctb/setup/recovery` |
| **Scheduling in MCTB** | MCTB does not own scheduling; legacy routes redirect to shared `/appointments/*` |
| **Booking link ownership** | One canonical source; AI Recovery controls entitled offer; Inbox/Missed Call Detail may send; Analytics uses `BOOKING_LINK_SENT`; Setup Links owns `{{link}}` / request form |
| **Ownership boundaries** | Text Back, Consent, Recovery, AI Recovery, Inbox, Missed Calls, Analytics, Overview — per freeze doc; no duplicate editors |

### Documentation (source of truth)

- **`docs/MCTB-LAUNCH-ARCHITECTURE-FREEZE.md`** — launch architecture freeze (nav, routes, feature-to-owner matrix, models, redirects, flags, deferred items)
- **`docs/MCTB-PASS-6-FINAL-RECONCILIATION.md`** — full Pass 6 report (54 sections)
- **`docs/MCTB-PASS-5-OVERVIEW-ANALYTICS.md`** — Pass 5 analytics/overview
- **`docs/MCTB-PASS-4-SETUP-CONSOLIDATION.md`** — Pass 4 setup

### Tests (PASS on Pass 6 branch)

```bash
npx tsx scripts/test-mctb-pass-6-final-reconciliation.ts
npx tsx scripts/test-mctb-nav-ia.ts
npx tsx scripts/test-mctb-pass-3-ai-recovery.ts
npx tsx scripts/test-mctb-pass-5-overview-analytics.ts
```

### Explicit non-goals (Pass 6)

- No visual redesign (spacing, typography, cards, shadows, animation)
- No schema changes
- No TeXML changes
- No SMS runtime changes
- No eligibility changes
- No AI runtime changes

### Deferred / non-blocking

- Voicemail operational inbox may still expose Setup shortcuts in greeting drawer (contextual links; not a duplicate full config editor)
- `ai-lead-recovery-page.tsx` presentation kept for compatibility
- Owner **browser** certification on all seven nav destinations + redirects + entitlements
- Owner **live telephony/SMS** certification

### PR map (this workstream)

| Pass | Branch | PR |
|------|--------|-----|
| 4 | `cursor/mctb-pass-4-setup-consolidation-2304` | #526 |
| 5 | `cursor/mctb-pass-5-overview-analytics-2304` | #527 |
| 6 | `cursor/mctb-pass-6-final-reconciliation-2304` | #528 |

---

## Executive verdict

**PASS — architecture freeze approved** (static reconciliation + focused tests). No P0 architecture blockers identified in Pass 6 scope.

**MCTB PRODUCT ARCHITECTURE FROZEN — READY FOR VISUAL UI/UX POLISH**

---

## What to do next

1. **Merge** PRs **#526**, **#527**, and **#528** to `master` when ready (Pass 6 branch bundles much of Passes 3–5).
2. **Stop architecture passes** — product structure is frozen per `docs/MCTB-LAUNCH-ARCHITECTURE-FREEZE.md`.
3. **Next phase for Kirsten (fundamentally different instruction):**
   - Open the actual application in the browser
   - Capture pages (screenshots / reference states)
   - Evaluate the visual system across the whole MCTB product (seven primary destinations + Setup sections)
   - Begin **UI/UX polish only** — spacing, typography, table density, cards, hierarchy, motion, responsive/a11y visual pass
   - Do **not** reopen product structure unless a concrete blocker appears (wrong product on canonical route, duplicate editor, sender/entitlement bypass, broken cross-links, etc.)

### Pass 6 blocker standard (for reference)

A blocker is **not** minor visual issues. Blockers look like:

- Canonical page renders wrong product
- Duplicate customer editor mutates same setting inconsistently
- Sender authority or entitlement bypass
- Route sends customer into wrong product
- Launch feature has no working runtime
- Critical cross-page relationship broken
- Schema/runtime contradiction prevents launch behavior

---

## Finish line (exact phrase on success)

MCTB PRODUCT ARCHITECTURE FROZEN — READY FOR VISUAL UI/UX POLISH
