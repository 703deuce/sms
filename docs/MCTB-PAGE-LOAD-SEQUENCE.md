# MCTB (Stage 2 Opus) — what loads before the page shows

This document answers: **from navigation start to visible content**, what runs, in what order, and what is questionable for routine page views.

Scope: **Stage 2** (`isNewUiStage2Enabled()`), routes under `/mctb/*` with the Opus shell (`NewUiTransplantShellLayout` + `OpusWorkspaceDataProvider`).

---

## 0. Mental model

| Layer | What the user sees | What actually gates it |
|--------|-------------------|-------------------------|
| **Browser** | Blank → shell chrome → “Loading…” → content | HTML TTFB (RSC), then client `useEffect` fetches |
| **Shell** | Sidebar + topbar | RSC layout props; header business line/sender may wait on `shell-context` |
| **Page** | Route-specific UI | Server loader **or** client APIs |

**A2P / Telnyx (your question):** Approval state should live in **our DB** after registration webhooks or an explicit “refresh status” action. Calling Telnyx on every `GET /api/mctb/setup` was wrong for navigation; that path now uses DB-only phone options on GET (see §2). Telnyx reconcile remains on **POST** setup (activate, existing-consent validation) via `loadMctbSetupPhoneOptionsWithTelnyxSync()`.

---

## 1. Universal path — every authenticated `/mctb/*` visit

Applies to all Stage 2 MCTB pages wrapped in the transplant shell.

### Phase A — Server (before any HTML)

1. **Session / workspace** — `requireWorkspaceContext()` or equivalent on RSC pages; middleware/session cookie.
2. **Route `page.tsx`** — If the page is an async Server Component, **all awaited server work completes before the response streams** (this is often the real “slow spinner” for Overview).
3. **`/mctb/layout.tsx`** — Stage 2: pass-through only (no extra data).

### Phase B — Client shell (parallel with page paint)

4. **Shell mounts** — `NewUiTransplantShellLayout` → `OpusWorkspaceDataProvider`.
5. **`GET /api/mctb/shell-context`** (client, `cache: "no-store"`):
   - Auth
   - `workspace` name + `customFieldsConfig`
   - `loadMissedCallTextConfig`
   - `loadMctbOnboardingState`
   - Derives `businessLineE164`, sender **label** (not live Telnyx), timezone  
   - **Does not** call Telnyx, `loadComplianceOverview`, or full setup.

**What blocks chrome:** Topbar/sidebar can render immediately with workspace name from layout props; **business line / sender in header** may show defaults until `shell-context` returns (`loading` in context).

### Phase C — Page body

Depends on route (§3). Client-only pages show their own “Loading…” until their fetches finish.

---

## 2. Shared API: `GET /api/mctb/setup` (still heavy)

Many pages call this **in addition to** shell-context. It is **not** Telnyx-synced on GET anymore, but it still does a large parallel bundle:

| Step | Work | Source of truth | Routine nav? |
|------|------|-----------------|--------------|
| Auth | session + workspaceId | — | Yes |
| Workspace row | `customFieldsConfig` | DB | Yes |
| Parallel | `loadMissedCallTextConfig` | DB | Yes |
| Parallel | `loadMissedCallTextBack` (solution) | DB | Yes |
| Parallel | `loadMctbSetupPhoneOptions` | DB | Yes |
| Parallel | `loadComplianceOverview` | DB (`loadRegistration` + **`loadPhoneNumbers` again**) | Debatable — registration status rarely changes per click |
| Parallel | `loadPhoneNumbers` | DB | **Duplicate** with compliance path |
| Parallel | `loadAdminMctbTestFlags` | DB/env | Admin only |
| Parallel | `loadMctbOnboardingState` | DB | Yes |
| Parallel | `getProductionMctbForwardTargetE164` | config/DB | Yes for setup |
| Then | `deriveRequiredActions`, messaging ready, sender presentation, schedule/pause, sanitize phone IDs, optional stale-phone repair write | derived | Some repair writes on read |

**Telnyx on GET:** removed (use `loadMctbSetupPhoneOptions` only).

**Telnyx on POST** (`/api/mctb/setup`): still uses `loadMctbSetupPhoneOptionsWithTelnyxSync()` for activate / existing-consent flows — appropriate.

**Dedupe:** `fetchMctbSetup()` in `mctb-setup-client.ts` shares one in-flight GET for 8s; **raw** `fetch("/api/mctb/setup")` bypasses dedupe (conversations, setup overview, detail, consent/text-back editors, number drawer).

---

## 3. Per-route: server vs client, order, what blocks “real” UI

### `/mctb` — Overview

| Order | What runs | Blocks first paint? |
|-------|-----------|---------------------|
| 1 | `requireWorkspaceContext()` | Yes (RSC) |
| 2 | **`loadMctbOverview(workspaceId)`** — entire overview payload | **Yes — user waits for full server render** |
| 3 | Client shell `shell-context` | No (overview already has data) |

**Inside `loadMctbOverview` (parallel batch 1):**

- Same family as setup GET: runtime config, onboarding, solution, phone options (DB), compliance overview, phone numbers, admin flags
- KPIs (`loadMctbOverviewKpis`)
- Recent missed calls (8 rows)
- Recent conversations (5 threads, last message)

**Then sequential / extra batch (often the multi-second tail):**

- `loadLeadRecoveryConfig`
- `computeLeadRecoveryPolicyHealth` + **`evaluateMctbAiBookingReadiness`** (Microsoft/Calendly audit, connection heal, booking context — not needed for “missed calls today” KPIs)
- **`loadMctbLineInboundConfig` + `resolveInboundHandlingDecision`** (inbound handling card)

**User-visible:** Stage 2 overview paints when step 2 finishes — no client loading gate. **Slow TTFB = slow overview loader**, not Telnyx on GET anymore.

---

### `/mctb/missed-calls`

| Order | What runs | Blocks first paint? |
|-------|-----------|---------------------|
| 1 | `requireWorkspaceContext()` | Yes |
| 2 | `loadMctbMissedCallsListData(workspaceId, query)` | Yes (SSR `initialData`) |
| 3 | `shell-context` | No |

**User-visible:** List should appear with SSR data; shell enriches in parallel.

---

### `/mctb/missed-calls/[id]`

| Order | What runs | Blocks content? |
|-------|-----------|-----------------|
| 1 | RSC page (minimal) | Shell only |
| 2 | Client: **`GET /api/mctb/missed-calls/:id`** + **`GET /api/mctb/setup`** in parallel | **Yes — “Loading missed call…”** |

Setup is only needed for sender label on detail — full setup payload is overkill.

---

### `/mctb/conversations`

| Order | What runs | Blocks content? |
|-------|-----------|-----------------|
| 1 | RSC: no inbox data (Stage 2) | Shell only |
| 2 | `shell-context` | Partial (header) |
| 3 | Client: **`GET /api/mctb/setup`** (raw fetch, no dedupe) — enrich business line/sender | No for main gate |
| 4 | Client: **`fetchInboxListPage`** then **up to 40 × `fetchConversation(id)` sequentially** | **Yes — “Loading conversations…”** |

**Anti-pattern:** List API returns rows; UI then N+1 full thread fetches before hiding loading. Legacy non–Stage 2 path SSR’d `loadConversations` on the server; Stage 2 does not.

---

### `/mctb/analytics`

| Order | What runs | Blocks? |
|-------|-----------|---------|
| 1 | `loadMctbAnalytics(workspaceId, range)` | Yes (SSR `initialData`) |
| 2 | `shell-context` | No |

---

### `/mctb/voicemail`

| Order | What runs | Blocks? |
|-------|-----------|---------|
| 1 | Entitlement check `hasMctbBundledVoicemailAccess` | Yes (upgrade card vs inbox) |
| 2 | Client: **`GET /api/phone/voicemail`** | **Yes — loading state in page** |

---

### `/mctb/setup` (overview)

| Order | What runs | Blocks? |
|-------|-----------|---------|
| 1 | `useMctbSetupOverviewWiring` | |
| 2 | **`GET /api/mctb/setup`** + **`GET /api/mctb/onboarding`** | **Yes until both return** |
| 3 | Then **background** (after `setLoading(false)`): parallel **`/api/mctb/overview`**, exclusions, handoff, live-test, voicemail | No — overview rows show after step 2 |

Step 3 re-runs **full overview loader** just for setup summary enrichment — expensive duplicate if user only opened setup.

---

### `/mctb/setup/*` section editors (phone, consent, text-back, recovery, test, …)

Typical pattern (`setup-wiring-hooks.ts`, `setup-hooks.ts`):

| Order | What runs | Blocks? |
|-------|-----------|---------|
| 1 | `fetchMctbSetup()` (deduped) or raw setup fetch | **Yes — section “Loading…”** |
| 2 | Some sections: onboarding, setup-test, handoff, exclusions (extra parallel fetches) | Yes for that section |

**Consent / text-back Opus editors** also raw-fetch `/api/mctb/setup` (and consent may fetch onboarding) — duplicate with shell + other hooks on same navigation.

---

### `/mctb/ai-recovery` / lead recovery surfaces

Client fetches context + config APIs (not fully inventoried here); not on critical daily ops path. Overview already pulls lead-recovery + AI booking readiness on every home load.

---

### `/onboarding/mctb`

Wizard runtime client fetches setup + onboarding; server may pass partial props. One-time flow — different performance bar.

---

## 4. What should *not* run on every page view (product view)

| Behavior | Today (GET / routine nav) | Better model |
|----------|---------------------------|--------------|
| Telnyx A2P reconcile per number | **Off GET**; still on POST activate/consent | Webhooks + jobs update DB; manual “Refresh messaging status” |
| Full `loadComplianceOverview` + duplicate `loadPhoneNumbers` | On every setup GET + overview | Cache per workspace; or only on Compliance / Numbers / setup “messaging blocked” |
| `evaluateMctbAiBookingReadiness` | Every overview load | Only AI Recovery / booking setup pages |
| `loadMctbOverview` via `/api/mctb/overview` | Setup overview background fetch | Slim setup-health DTO without KPIs/AI/inbound |
| 40× conversation detail fetch | Conversations Stage 2 | List payload sufficient for inbox; lazy-load selected thread |
| Full `/api/mctb/setup` | Missed call detail (sender label), conversations (sender line) | Shell-context or tiny `GET /api/mctb/sender-summary` |

---

## 5. Quick reference diagram

```
User navigates to /mctb/...
        │
        ▼
[Server] session + workspace
        │
        ├─► RSC page awaits? ──► loadMctbOverview | missed-calls list | analytics | entitlement
        │         (blocks HTML for that route)
        ▼
[Client] Opus shell mounts
        │
        ├─► GET /api/mctb/shell-context  (light chrome)
        │
        └─► Page client effects
              ├─► GET /api/mctb/setup (heavy, many pages)
              ├─► GET /api/mctb/onboarding (setup)
              ├─► inbox list + N× conversation (conversations)
              └─► route-specific APIs
```

---

## 6. Related code entry points

| Concern | File |
|---------|------|
| Shell fetch | `src/newui-transplant/context/opus-workspace-data.tsx` |
| Shell API | `src/app/api/mctb/shell-context/route.ts` |
| Setup GET | `src/app/api/mctb/setup/route.ts` (GET ~line 119) |
| Telnyx sync | `src/lib/mctb/setup-telnyx-messaging-sync.ts` (POST only) |
| Overview loader | `src/lib/mctb/overview.ts` |
| Conversations N+1 | `src/newui-transplant/connected/mctb/conversations-page.tsx` (`loadList`) |
| Setup overview wiring | `src/newui-transplant/connected/mctb/mctb-setup-overview-wiring.ts` |
| Perf notes / Telnyx fix | `docs/MCTB-PAGE-LOAD-PERFORMANCE.md` |

---

*Last updated to match `master` after GET-path Telnyx removal (`loadMctbSetupPhoneOptions` on GET/overview).*
