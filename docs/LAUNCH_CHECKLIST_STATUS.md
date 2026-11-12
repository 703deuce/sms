# Transovo Launch Checklist — Test Status

**Updated:** 2026-08-16 (full backend + browser audit)  
**Scope:** SMS excluded · Stripe/payment flows excluded · no port submit · no new number purchase  
**Legend:** ✅ Automated pass · ❌ Automated fail · 🔶 Manual/live required · ⏭️ Out of scope

---

## Executive summary

| Area | Status |
|------|--------|
| **Personal/Business workspace split** | ✅ Automated + browser |
| **Premium vanity scoring (hermetic)** | ✅ Automated |
| **Number product / Smart Routing (hermetic)** | ✅ Automated |
| **LiveKit Amy (generic receptionist)** | ✅ 16/16 preprod + booking orchestration |
| **Frontend browser walkthrough (production)** | ✅ **21 routes PASS** (smoke-login) |
| **Telnyx Caller Amy (legacy webhook path)** | ❌ Preprod FAIL — tools retired (expected) |
| **Production gauntlet / enterprise gate** | ❌ Legacy Telnyx tool filters (expected on LiveKit-only) |
| **Live phone / PSTN / port / forwarding** | 🔶 Manual required |
| **Production deploy** | 🔶 Redeploy `master` after coolify-install fix |
| **Launch gate (Phase 34)** | 🔶 **Partial** — hermetic + UI pass; live PSTN/Stripe remain |

**Browser walkthrough:** `node scripts/launch-checklist-browser-walkthrough.mjs` against production — **PASS** (21 routes, 0 fails). Screenshots: `/opt/cursor/artifacts/launch-walkthrough/`. Manual agent report: `/opt/cursor/artifacts/launch-walkthrough-manual/`.

---

## Phase 1 — Account, login, workspace split

| Item | Status | Evidence |
|------|--------|----------|
| Workspace split (Personal/Business) | ✅ | `test-workspace-split.ts`, browser toggle |
| Personal actions routing | ✅ | `test-personal-actions.ts` |
| Smoke-login + workspace cookies | ✅ | Browser walkthrough |
| Auth login/logout/reset/session | 🔶 | Manual + Supabase |
| Cross-user isolation | 🔶 | Gauntlet VOICE_E2E partial |

**Phase 1 gate:** ✅ Core split automated + UI verified.

---

## Phase 2 — Personal navigation

| Item | Status | Evidence |
|------|--------|----------|
| Nav routes / no business items | ✅ | `test:nav-crosswalk` (81 platform routes) |
| UI click-through Personal menu | ✅ | Browser: `/personal`, vault, numbers, forwarding, voicemail |

---

## Phase 3 — Ordinary number search

| Item | Status | Evidence |
|------|--------|----------|
| Lifecycle / checkout guards | ✅ | `test:number-product-lifecycle` |
| Preprod hermetic gate | ✅ | `test:number-product-preprod` |
| Personal find UI | ✅ | `/personal/numbers/find` → premium search |
| Live Telnyx area-code search | 🔶 | Premium search UI: 60 results for 540 + Lawn care |
| Purchase without payment | ⏭️ Stripe excluded |

---

## Phase 4 — Premium / Vanity search

| Item | Status | Evidence |
|------|--------|----------|
| Scoring regression | ✅ | `test:vanity-number-scoring` |
| Live inventory search UI | ✅ | Browser: area 540, industry Lawn care, 60 numbers |
| Pricing session freeze | 🔶 | Select number OK; checkout not tested |

---

## Phase 5–11 — Purchase, port, vault, forwarding, voicemail

| Item | Status | Evidence |
|------|--------|----------|
| Checkout / Telnyx provision | 🔶 | Stopped before Stripe |
| Port in form UI | ✅ | Form loads, sample fill, no submit |
| Number Vault UI | ✅ | `/personal/vault` |
| Personal forwarding UI | ✅ | `/personal/forwarding` |
| Personal voicemail UI | ✅ | `/personal/voicemail` |
| Live forward / voicemail PSTN | 🔶 | Real phone test |

---

## Phase 12 — Business number basics

| Item | Status | Evidence |
|------|--------|----------|
| Telephony provisioning unit | ✅ | `test:telephony-provisioning` |
| Inbound TeXML plumbing | ✅ | `test-inbound-e2e-plumbing` |
| Business numbers UI | ✅ | `/numbers` — existing +18663464256 |
| Live inbound call | 🔶 | Manual |

---

## Phase 13 — Smart Routing / IVR

| Item | Status | Evidence |
|------|--------|----------|
| Compiler + simulator | ✅ | `test:smart-routing-preprod` 7/7 |
| Smart Routing UI | ✅ | `/smart-routing`, `/smart-routing/new` |
| Live PSTN IVR | 🔶 | `SMART_ROUTING_LIVE_TEST=1` |

**Note:** Routes are `/smart-routing` (not `/solutions/smart-routing`).

---

## Phase 14–28 — Amy (LiveKit path)

| Item | Status | Evidence |
|------|--------|----------|
| LiveKit preprod | ✅ | 16/16 |
| Booking orchestration | ✅ | 11/11 |
| Master receptionist runtime | ✅ | 24 tests |
| Runtime truth guards | ✅ | All passed |
| Tool feedback normalization | ✅ | Prior suite |
| Voice overview / receptionist / agents UI | ✅ | Browser walkthrough |
| Caller Amy Telnyx preprod | ❌ | Legacy tools retired |
| Gauntlet AGENT_DECISION | ❌ | 2/4 (legacy book guard) |
| Live audio / concurrent calls | 🔶 | Manual |
| Dashboard phone minutes | ✅ | Code on master; UI on `/voice/overview` |

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
| Coolify npm ci fix | ✅ | Pushed — redeploy to confirm |
| TypeScript | ✅ | `npx tsc --noEmit` on master |
| Telnyx wiring | ✅ | `test:telnyx-wiring` |

---

## Phase 31–33 — Webhooks, multi-tenant, E2E

| Item | Status | Evidence |
|------|--------|----------|
| Gateway failure injection | ✅ | Prior suite |
| Book idempotency | ✅ | Prior suite |
| Production gauntlet | ❌ | TOOL 6/6, AGENT 2/4, VOICE 3/3 |
| Enterprise gate | ❌ | Retired Telnyx publish filters |
| Workflow runtime authority | ⚠️ | 1 fail: utterance inference (hermetic) |

---

## Phase 34 — Launch gate

| Gate | Status |
|------|--------|
| Personal/Business switching | ✅ |
| Ordinary/premium search UI | ✅ |
| Port / vault / forwarding / voicemail UI | ✅ (live PSTN 🔶) |
| Smart Routing UI + hermetic | ✅ |
| Amy LiveKit booking path | ✅ auto |
| Browser production walkthrough | ✅ 21/21 routes |
| Stripe checkout / port submit | ⏭️ / 🔶 |
| Live PSTN torture | 🔶 |

**Overall launch gate: 🔶 PARTIAL** — ready for your manual PSTN/Stripe session.

---

## Route map (browser testing)

Use these paths (common mistakes from wrong URLs):

| Wrong (404) | Correct |
|-------------|---------|
| `/calls`, `/calls/all` | `/voice/calls` |
| `/leads` | `/integrations/native/leads` or `/realtor/leads` |
| `/solutions/dashboard` | `/outcomes` |
| `/solutions/smart-routing` | `/smart-routing` |
| `/numbers/ordinary` | `/personal/numbers/find` |

---

## Automated command bundle

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
npm run test:master-receptionist-runtime
npm run test:runtime-truth-guards
npm run test:telnyx-wiring
npm run test:telephony-provisioning
BASE_URL=$APP_URL OWNER_EMAIL=$ADMIN_EMAILS node scripts/launch-checklist-browser-walkthrough.mjs
npm run test:caller-amy-preprod   # expects FAIL on legacy Telnyx path
npm run test:production-gauntlet  # expects 2 legacy AGENT_DECISION fails
```

---

## Your manual session (after this audit)

1. Redeploy `master` → confirm Coolify build completes  
2. Live forward + voicemail on Personal number (existing number)  
3. Business IVR live call (`SMART_ROUTING_LIVE_TEST=1`)  
4. IVR → LiveKit Amy → book appointment (real phone)  
5. Verify dashboard call log + phone minutes + booking outcome  
6. Stripe checkout once (optional) · port submit when ready
