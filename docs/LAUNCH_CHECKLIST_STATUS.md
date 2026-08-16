# Transovo Launch Checklist — Test Status

**Generated:** 2026-08-16  
**Scope:** SMS excluded · Stripe/payment flows excluded  
**Legend:** ✅ Automated pass · ❌ Automated fail · 🔶 Manual/live required · ⏭️ Out of scope

---

## Executive summary

| Area | Status |
|------|--------|
| **Personal/Business workspace split** | ✅ Automated |
| **Premium vanity scoring (hermetic)** | ✅ Automated |
| **Number product / Smart Routing (hermetic)** | ✅ Automated |
| **LiveKit Amy (generic receptionist)** | ✅ Automated suites pass |
| **Telnyx Caller Amy (legacy webhook path)** | ❌ Preprod FAIL — tools retired |
| **Live phone / PSTN / port / forwarding** | 🔶 Manual required |
| **Production deploy** | 🔶 Fix pushed (`coolify-install`); redeploy to verify |
| **Launch gate (Phase 34)** | ❌ **Not ready** |

**Automated suites run:** 40+ scripts · **Caller Amy preprod:** 730/753 assertions, **1/6 gates**

---

## Phase 1 — Account, login, workspace split

| Item | Status | Evidence |
|------|--------|----------|
| Workspace split (Personal/Business) | ✅ | `scripts/test-workspace-split.ts` |
| Personal actions routing | ✅ | `scripts/test-personal-actions.ts` |
| Auth login/logout/reset/session | 🔶 | Manual + Supabase |
| Cross-user isolation | 🔶 | `test-production-gauntlet` VOICE_E2E partial |
| URL permission bypass | 🔶 | Manual security test |

**Phase 1 gate:** 🔶 Partial — core split automated; auth/isolation need manual.

---

## Phase 2 — Personal navigation

| Item | Status | Evidence |
|------|--------|----------|
| Nav routes / no business items | ✅ | `test:nav-crosswalk` (81 platform routes) |
| UI click-through each menu item | 🔶 | Manual browser |

---

## Phase 3 — Ordinary number search

| Item | Status | Evidence |
|------|--------|----------|
| Lifecycle / checkout guards | ✅ | `test:number-product-lifecycle` |
| Preprod hermetic gate | ✅ | `test:number-product-preprod` |
| Live Telnyx area-code search | 🔶 | Manual + `test-vanity-numbers --area-code` |
| Purchase without payment | ⏭️ Stripe excluded |

---

## Phase 4 — Premium / Vanity search

| Item | Status | Evidence |
|------|--------|----------|
| Scoring regression (MOWER, LAWN, ROOF, etc.) | ✅ | `test:vanity-number-scoring` |
| Pattern exclusivity / business match | ✅ | Same suite |
| Live inventory search | 🔶 | `test-vanity-numbers --area-code 540` returned mostly Ordinary (inventory/API) |
| Pricing session freeze | 🔶 | Manual checkout session test |

---

## Phase 5–11 — Purchase, port, vault, forwarding, voicemail

| Item | Status |
|------|--------|
| Checkout / Telnyx provision / webhooks | 🔶 Manual (Stripe excluded) |
| Port away / port in | 🔶 Manual + Telnyx |
| Number Vault UI/actions | 🔶 Manual |
| Personal forwarding live call | 🔶 Real PSTN test |
| Personal voicemail record/playback | 🔶 Real PSTN test |

---

## Phase 12 — Business number basics

| Item | Status | Evidence |
|------|--------|----------|
| Telephony provisioning unit | ✅ | `test:telephony-provisioning` |
| Inbound TeXML plumbing | ✅ | `test-inbound-e2e-plumbing` |
| Live inbound call | 🔶 | Manual |

---

## Phase 13 — Smart Routing / IVR

| Item | Status | Evidence |
|------|--------|----------|
| Compiler + simulator | ✅ | `test:smart-routing-compiler` |
| Preprod suite | ✅ | `test:smart-routing-preprod` 7/7 |
| Live PSTN IVR edge cases | 🔶 | Manual (`SMART_ROUTING_LIVE_TEST=1`) |

---

## Phase 14–28 — Amy (LiveKit path)

| Item | Status | Evidence |
|------|--------|----------|
| LiveKit preprod | ✅ | `test:amy-livekit-preprod` 16/16 |
| Booking orchestration | ✅ | `test:voice-livekit-booking-orchestration` 11/11 |
| Booking intake / UX / edge cases | ✅ | booking test suite |
| Tool feedback normalization | ✅ | `test-tool-feedback-normalize` |
| Master receptionist runtime | ✅ | 24 tests |
| Runtime truth guards | ✅ | `test-runtime-truth-guards` |
| Workflow runtime authority | ✅ | `test-workflow-runtime-authority` |
| Caller Amy Telnyx preprod | ❌ | Legacy `runtime_turn` / `continue_workflow` retired |
| Live audio torture / concurrent calls | 🔶 | Manual |
| Dashboard outcome after call | 🔶 | Manual (phone minutes on dashboard ✅ code merged) |

---

## Phase 29 — Usage and billing

| Item | Status |
|------|--------|
| Metering attribution | 🔶 Partial automated |
| Stripe billing | ⏭️ Excluded |

---

## Phase 30 — Infrastructure

| Item | Status | Evidence |
|------|--------|----------|
| Coolify npm ci fix | ✅ | Pushed `a4f7809` — **redeploy to confirm** |
| TypeScript | ✅ | `npx tsc --noEmit` (on master) |
| Service health webhooks | 🔶 | Production smoke |

---

## Phase 31–33 — Webhooks, multi-tenant, E2E scenarios

| Item | Status | Evidence |
|------|--------|----------|
| Telnyx wiring | ✅ | `test:telnyx-wiring` |
| Gateway failure injection | ✅ | `test-gateway-failure-injection` |
| Book idempotency | ✅ | `test-book-idempotency` |
| Production gauntlet | ❌ | AGENT DECISION 2/4 failures |
| Enterprise gate | ❌ | 2 failures (retired Telnyx tool publish filters) |
| Scenarios A–H | 🔶 | Manual real-world |

---

## Phase 34 — Launch gate

| Gate | Status |
|------|--------|
| Personal/Business switching | ✅ Auto |
| Ordinary/premium search | 🔶 / ✅ scoring |
| Purchase / port / vault / forwarding / voicemail | 🔶 |
| Smart Routing | ✅ hermetic |
| IVR → Amy / Amy booking | ✅ LiveKit auto · ❌ Telnyx legacy |
| Multi-tenant / deploy / diagnostics | 🔶 / partial |

**Overall launch gate: ❌ NOT PASSED**

---

## Recommended test order (next manual session)

1. Redeploy `master` → confirm Coolify build completes  
2. Personal workspace smoke (nav, My Numbers)  
3. Premium search UI + one purchase path (without Stripe if needed)  
4. Live forward + voicemail on Personal number  
5. Business IVR live call (`SMART_ROUTING_LIVE_TEST=1`)  
6. IVR → LiveKit Amy → book appointment (real phone)  
7. Verify dashboard call log + phone minutes + booking outcome  

---

## Automated command bundle (re-run anytime)

```bash
npm run test:nav-crosswalk
npx tsx scripts/test-workspace-split.ts
npx tsx scripts/test-personal-actions.ts
npm run test:vanity-number-scoring
npm run test:number-product-lifecycle
npm run test:number-product-preprod
npm run test:smart-routing-preprod
npm run test:amy-livekit-preprod
npm run test:voice-livekit-booking-orchestration
npm run test:caller-amy-preprod   # expects FAIL on legacy Telnyx path
npx tsx scripts/test-production-gauntlet.ts
```
