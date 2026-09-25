# Voice — Final Navigation Reconciliation

**Date:** 2026-09-25  
**Pass:** Customer-facing Voice / AI Receptionist navigation only (no page redesign, no runtime changes)

**Status:** `VOICE NAVIGATION RECONCILIATION COMPLETE — READY FOR FINAL CROSS-PAGE CERTIFICATION`

---

## 1. Voice nav definitions found

| Source | Role |
|--------|------|
| **`src/lib/products/voice-ia-nav.ts`** | **New** — single canonical six-destination definition |
| `src/lib/products/mctb-nav.ts` | Bundled MCTB shell — composes `buildVoiceIaPrimaryNavItems` when `hasVoice` |
| `src/lib/products/ai-after-hours-nav.ts` | Standalone `ai_after_hours` product shell — same six destinations + Numbers + account |
| `src/lib/products/resolve-product-nav.ts` | Chooses shell nav by entitlement/path |
| `src/lib/products/voice-nav.ts` | Legacy MCTB shell / mass SMS (unchanged Voice IA core) |
| `src/components/voice/voice-nav.ts` | **Contextual** `VoiceSubNav` (section tabs), not global IA |
| `src/lib/nav.ts` | Legacy global nav fragments (not primary Voice product IA) |

---

## 2. Consumers of `ai-after-hours-nav.ts`

| Consumer | Usage |
|----------|--------|
| `resolve-product-nav.ts` | Sidebar: `buildAiAfterHoursNav`; mobile: `buildAiAfterHoursMobileNav` |
| `app-shell.tsx` | `getAiAfterHoursPageTitle` |
| `mobile-nav.tsx` | `buildAiAfterHoursMobileNav` (icons mapping; resolved mobile uses same via `resolveProductMobileNav`) |
| `scripts/test-product-shell.ts` | Static assertions |
| `scripts/test-ai-after-hours-cert.ts` | Gate 2 nav check |

`sidebar.tsx` had an unused import of `buildAiAfterHoursNav` — **removed**.

---

## 3. Why both builders existed

- **`buildMctbV1Nav`** — Primary V1 launch shell when workspace has MCTB (and optional Voice entitlement). Already aligned to six-destination IA.
- **`buildAiAfterHoursNav`** — Used when `productShell === "ai_after_hours"` (standalone AI After Hours entitlement / path). It retained **legacy** agent-builder IA (`AI Agent` → `/voice/agents`, `Knowledge`, `Call Handling` → `/voice/inbound-routing`).

Both are **customer-facing** depending on shell resolution — hence the inconsistency.

---

## 4. Customer-facing surfaces reconciled

- Standalone AI After Hours sidebar  
- Bundled MCTB + Voice sidebar (unchanged structure, now shared constant)  
- Mobile bottom nav for `ai_after_hours` shell (was incorrectly returning full sidebar nav)  
- Page titles via `getVoiceIaPageTitle` / `getAiAfterHoursPageTitle` / `getMctbPageTitle`

---

## 5. Files changed

- `src/lib/products/voice-ia-nav.ts` (new)
- `src/lib/products/ai-after-hours-nav.ts`
- `src/lib/products/mctb-nav.ts` (compose shared IA)
- `src/lib/products/resolve-product-nav.ts` (mobile `ai_after_hours`)
- `src/components/voice/voice-nav.ts` (active route matching)
- `src/components/layout/sidebar.tsx` (remove unused import)
- `src/components/layout/mobile-nav.tsx` (mobile builder signature)
- `scripts/test-voice-ia-nav.ts` (new)
- `scripts/test-mctb-nav-ia.ts`, `test-product-shell.ts`, `test-ai-after-hours-cert.ts`

---

## 6–7. Final navigation

**Bundled (MCTB + `hasVoice`):**  
AI Receptionist section → Overview · Calls · Receptionist · Business Knowledge · Call Handling · Analytics  
(then MCTB section, shared links — unchanged)

**Standalone (`ai_after_hours`):**  
Same six destinations (section label = AI After Hours display name) + **Numbers** under Manage + account items.

---

## 8. Entitlement differences

- Voice six-pack appears in MCTB nav only when `hasVoice` is true.  
- Standalone shell uses full six-pack when `ai_after_hours` shell is active.  
- No pages exposed without existing entitlement logic — **authorization unchanged**.

---

## 9–10. Desktop / mobile

- **Desktop:** `resolveProductSidebarNav` → reconciled `buildAiAfterHoursNav` or `buildMctbV1Nav`.  
- **Mobile:** `ai_after_hours` now uses `buildAiAfterHoursMobileNav()` (Overview, Calls, Receptionist, Business Knowledge) instead of full sidebar list.

---

## 11. VoiceSubNav

- Remains **contextual** section tabs (Agents, Phone & routing, Calls, Analytics).  
- **Not** global product IA.  
- Updated **active matching** so `/voice/inbound-routing` and `/voice/operations` highlight **Call Handling**; `/voice/needs-attention` highlights **Calls**.  
- Overview: still no sub-nav (`getVoiceSectionForPath` returns null).

---

## 12. Active-route matching

| Path | Logical parent |
|------|----------------|
| `/voice/calls/[id]` | Calls |
| `/voice/inbound-routing` | Call Handling |
| `/voice/operations` | Call Handling |
| `/voice/needs-attention` | Calls (redirect target) |
| `/voice/analytics/after-hours` | Analytics (redirect) |

Implemented in `resolveVoiceIaNavParent` + `isVoiceNavItemActive`.

---

## 13. Compatibility routes

**Preserved** (not added to primary nav):  
`/voice/needs-attention` → `/voice/calls?attention=open`  
`/voice/operations` → `/voice/call-handling`  
`/voice/analytics/after-hours` → `/voice/analytics`  
`/voice/inbound-routing` remains reachable (advanced routing link from Call Handling UI).

---

## 14–15. Legacy labels

**Removed from customer primary Voice nav:** AI Agent, Knowledge (alone), Inbound Routing as Call Handling peer.

**Retained internally:** `ai-after-hours-nav.ts` filename, `/voice/inbound-routing` route, VoiceSubNav “Inbound routing” tab label (advanced contextual tab, not primary shell).

---

## 16. MCTB navigation

**Unchanged** MCTB Missed Calls, Inbox, Voicemail, Setup, etc. No flattening into Voice.

---

## 17. Global Call Handling ownership

**No changes** to switcher or runtime ownership. Navigation only.

---

## 18. Tests

| Script | Result |
|--------|--------|
| `npx tsx scripts/test-voice-ia-nav.ts` | PASS |
| `npx tsx scripts/test-mctb-nav-ia.ts` | PASS |
| `npx tsx scripts/test-product-shell.ts` | PASS |

---

## 19. Protected / runtime files changed

**NONE** (Voice V3, LiveKit, MCTB runtime, Prisma, etc.)

---

## 20. Remaining navigation issues

- **VoiceSubNav** still shows “Inbound routing” as an **advanced** tab under Phone & routing — intentional contextual link, not primary shell.  
- **Outcomes / solutions catalog** may still reference `/voice/inbound-routing` in marketing copy — out of scope for this pass.  
- **Legacy `src/lib/nav.ts`** global entries not fully audited — not used for locked six-destination product shells above.

---

VOICE NAVIGATION RECONCILIATION COMPLETE — READY FOR FINAL CROSS-PAGE CERTIFICATION
