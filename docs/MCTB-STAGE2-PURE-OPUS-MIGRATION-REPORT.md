# MCTB Stage 2 — Pure Opus frontend migration report

**Branch:** `cursor/mctb-stage2-pure-opus-2304`  
**PR:** #549 (draft)  
**Scope:** Presentation + Stage 2 wiring (no backend/runtime rewrites)

---

## Certification

| Gate | Target | Result |
|------|--------|--------|
| `MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS` | 0 | **0** (`npm run verify:mctb-stage2-legacy-imports`) |
| `MCTB_CUSTOMER_VISIBLE_DEMO_STATE` (connected/public shells) | 0 | **0** (`npm run verify:mctb-stage2-demo-state`) |
| `MCTB_STAGE2_FRONTEND` | PURE_OPUS | **PURE_OPUS** (Stage 2 path; rollback preserved) |

---

## 1. Migration summary

| Metric | Value |
|--------|------:|
| MCTB customer routes audited (Stage 2) | 22 |
| Presentation migrations (known gaps) | 4 |
| Wiring corrections (demo → real/empty) | 8 surfaces |

---

## 2. Route matrix (Stage 2 ON)

| Route | Opus layout | Opus controls | Legacy presentation | Legacy CSS | Real data/state | Backend preserved | Result |
|-------|-------------|---------------|---------------------|------------|-----------------|-------------------|--------|
| `/mctb` | Yes | Yes | 0 | No | Yes (`loadMctbOverview`) | Yes | Pass |
| `/mctb/missed-calls` | Yes | Yes | 0 | No | Yes (list API + pagination) | Yes | Pass |
| `/mctb/missed-calls/[id]` | Yes | Yes | 0 | No | Yes (detail + setup sender) | Yes | Pass |
| `/mctb/conversations` | Yes | Yes | 0 | No | Yes (inbox API; setup context) | Yes | Pass |
| `/mctb/voicemail` | Yes | Yes | 0 | No | Yes (voicemail API) | Yes | Pass |
| `/mctb/voicemail` (not entitled) | Yes | Yes | 0 | No | Yes (entitlement gate) | Yes | Pass |
| `/mctb/analytics` | Yes | Yes | 0 | No | Yes (`loadMctbAnalytics`) | Yes | Pass |
| `/mctb/ai-recovery` | Yes | Yes | 0 | No | Yes (context + config APIs) | Yes | Pass |
| `/mctb/setup` | Yes | Yes | 0 | No | Yes (overview wiring) | Yes | Pass |
| `/mctb/setup/phone` | Yes | Yes | 0 | No | Yes (phone wiring) | Yes | Pass |
| `/mctb/setup/*` (other sections) | Yes | Yes | 0 | No | Yes (per-section hooks/editors) | Yes | Pass |
| `/mctb/compliance/consent` | Yes | Yes | 0 | No | Yes | Yes | Pass |
| `/onboarding/mctb` | Yes | Yes | 0 | No | Yes (runtime + Opus drawer) | Yes | Pass |
| `/f/mctb/[token]` | Yes | Yes | 0 | N/A | Yes (public API) | Yes | Pass |

Stage 2 **OFF** retains legacy UI + `mctb-legacy-shell-styles` + `public-request-form-legacy.tsx`.

---

## 3. Presentation migrations

| Legacy (Stage 2 path) | Opus replacement | Behavior reused |
|------------------------|------------------|-----------------|
| `MctbNumberDrawerHost` | `MctbNumberDrawerOpus` + `useMctbNumberDrawerController` | Yes |
| `AddOnUpgradeCard` (voicemail gate) | `MctbAddOnUpgradeOpus` | Yes |
| `/f/mctb/[token]` root shadcn | `MctbPublicRequestFormOpusPage` | Yes |
| Global `components/mctb/shell/*.css` on all MCTB routes | Gated to Stage 2 OFF only | Rollback intact |

---

## 4. Wiring corrections

| Surface | Change |
|---------|--------|
| `/mctb/setup` | Live path uses API rows only; no `CALL_FLOW` / `OPERATIONS` / `ACTIVITY` demo fallback when `wired` is set |
| `/mctb/setup/phone` | Live path uses real verification/sender/forwarding; no fake Sep 24 verification or sandbox numbers |
| `/mctb/missed-calls` | No hardcoded stat deltas when live; zeros instead of demo counts |
| `/mctb/conversations` | No sandbox inbox fixtures when `wiring` set; business line/sender from `/api/mctb/setup`; assignee UI hidden in production |
| `/mctb/ai-recovery` | Live defaults off/empty instead of demo booking URL and enabled=true |
| `/mctb/setup/test` | Live path uses real checkpoints only |
| `/mctb/missed-calls/[id]` | Sender shows `—` when unwired (no `BUSINESS.sender`) |
| Onboarding | Opus drawer; legacy wizard CSS only loads for legacy shell |

---

## 5. Backend preservation

No changes to telephony, TeXML, SMS, consent runtime, provisioning APIs, schema, entitlements logic, or analytics backends.

Client-only extraction: `mctb-number-drawer-controller.ts`.

---

## 6. Backend defects discovered (report only)

| Issue | Notes |
|-------|--------|
| Per-thread consent label in Inbox | Conversation API does not expose MCTB consent ledger fields; UI shows `—` unless opted-out tag present. Link to consent log remains canonical audit path. |

---

## 7. Deferred (not required for this pass)

- Deleting `src/components/mctb/**` or removing Stage 2 OFF dual path
- Inbox assignment feature (UI hidden in MCTB production path)
- Mirror-only sandbox fixtures used for non-connected previews (not customer Stage 2)

---

## 8. Verification commands

```bash
npm run verify:mctb-stage2-legacy-imports
npm run verify:mctb-stage2-demo-state
```

**Not merged. Not deployed.**
