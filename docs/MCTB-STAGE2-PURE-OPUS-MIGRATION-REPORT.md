# MCTB Stage 2 — Pure Opus frontend migration report

**Branch:** `cursor/mctb-stage2-pure-opus-2304`  
**Scope:** Presentation layer only — backend/runtime preserved  
**Certification:** `npm run verify:mctb-stage2-legacy-imports`

---

## 1. Migration summary

| Metric | Value |
|--------|------:|
| MCTB customer routes audited (Stage 2 path) | 22 |
| Rendered legacy components replaced in Stage 2 path | 3 explicit gaps + global CSS |
| Remaining prohibited **imports** in Opus MCTB trees | **0** |

**Static guard:** `MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0`

---

## 2. Route matrix (Stage 2 ON)

| Route | Opus root | Opus controls | Legacy components rendered | Legacy CSS on route | Backend preserved | Result |
|-------|-----------|---------------|----------------------------|---------------------|-------------------|--------|
| `/mctb` | Yes | Yes | 0 | No (layout gated) | Yes | Pass |
| `/mctb/missed-calls` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/missed-calls/[id]` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/conversations` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/voicemail` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/voicemail` (not entitled) | `MctbAddOnUpgradeOpus` | Yes | 0 | No | Yes | Pass |
| `/mctb/analytics` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/ai-recovery` | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/setup` + sections | Yes | Yes | 0 | No | Yes | Pass |
| `/mctb/compliance/consent` | Yes | Yes | 0 | No | Yes | Pass |
| `/onboarding/mctb` | Yes | Yes | 0 | No (onboarding wizard CSS deferred) | Yes | Pass |
| `/f/mctb/[token]` | Yes | Yes | 0 | N/A (public) | Yes | Pass |
| Legacy redirects (`/mctb/numbers`, rules, etc.) | N/A | N/A | 0 | No | Yes | Pass |

Stage 2 **OFF** continues to render legacy components and loads `MctbLegacyShellStyles` + `public-request-form-legacy.tsx` for rollback.

---

## 3. Component replacements

| Previous legacy (Stage 2 path) | New Opus implementation | Behavior reused |
|--------------------------------|-------------------------|-----------------|
| `MctbNumberDrawerHost` (`components/mctb/numbers`) | `MctbNumberDrawerOpus` + `useMctbNumberDrawerController` | Yes — same APIs, search, provision, TFV |
| `AddOnUpgradeCard` (voicemail gate) | `MctbAddOnUpgradeOpus` | Yes — same entitlement check + billing link |
| `/f/mctb/[token]` root `Card`/`Button` | `MctbPublicRequestFormOpusPage` | Yes — same public API + submit flow |

---

## 4. Backend preservation

No changes to:

- MCTB APIs, Prisma models, TeXML ingress, SMS/consent runtime, provisioning, entitlements, webhooks, or server actions.

**Presentation-only additions:**

- `src/lib/mctb/numbers/mctb-number-drawer-controller.ts` — extracted client controller (behavior moved from legacy drawer; not a backend change).
- `src/lib/products/add-on-feature-copy.ts` — shared copy for legacy + Opus upgrade surfaces.

---

## 5. Wiring findings (not migration blockers)

These are **Opus facade / demo fallback** issues tracked separately (`docs/TRANSOVO-NEWUI-OPUS-BACKEND-WIRING-GAP-INVENTORY.md`):

- Mirror routes may still reference `BUSINESS.*` sandbox when `wired` props are absent (connected pages pass real wiring).
- Missed-call detail sender now shows `—` when API wiring missing instead of sandbox phone.
- Setup overview/phone use `useMctbSetup*Wiring` — confirm production data on live workspace smoke.

---

## 6. Static guard

```bash
npm run verify:mctb-stage2-legacy-imports
```

**Result:** `MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0`

Scanned trees:

- `src/newui-transplant/components/mctb`
- `src/newui-transplant/connected/mctb`
- `src/newui-transplant/mirror/routes/mctb`
- `src/app/f/mctb` (excluding `*-legacy.*` rollback files)

---

## 7. Final state

**MCTB_STAGE2_FRONTEND: PURE_OPUS**

All known customer-visible Stage 2 MCTB surfaces use `newui-transplant` presentation. Legacy source remains in-repo for Stage 2 OFF rollback only.
