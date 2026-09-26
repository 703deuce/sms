# Production authenticated navigation performance fix

## Objective

Ordinary authenticated navigation must be **read-only, local, and cheap**. Provider reconciliation, provisioning, dashboard aggregation, and duplicate client fetching were removed from the global navigation path without changing product behavior or telephony runtimes.

## Before — request waterfall (representative)

### Shared `(app)/layout` (every authenticated page)

1. `getSession` + maintenance check  
2. `loadShellData` in parallel with outcomes, voice agent id, **duplicate** `loadWorkspace`, entitlements  
3. `loadShellData` internally called **`loadDashboardMetrics`** → `campaign.findMany({ take: 200 })` + registration + contacts + usage (dashboard-only work on every nav)  
4. Phone numbers, workspaces, inbox unread, notification counts  

### Call handling (client, duplicated)

1. `CallHandlingSwitcher` in **Sidebar** → `GET /api/call-handling` (`cache: "no-store"`)  
2. `CallHandlingSwitcher` in **Header** → second identical `GET`  
3. `CallHandlingDashboardCard` on MCTB home → third `GET`  
4. Each `GET` invoked `loadCallHandlingOwnershipState` → **`resolveEffectiveCallHandler`** → Telnyx:
   - `verifyMctbTexmlIngressRoute` / `ensureMctbTexmlApplication`  
   - `findOrCreateVoiceV3BasicCallControlApp`  
   - `GET /phone_numbers/{id}`  
   - Often **~3–5s** warm per request × 2+ per page  

### Voice overview (example page waterfall)

1. Full layout cost above  
2. Hydrate → `useEffect` → `GET /api/voice/overview` → `loadVoiceOverviewSummary` (second server round trip for primary content)

### Serial vs parallel

Layout used `Promise.all` for top-level slices, but call-handling Telnyx work was **serial inside each GET**, and duplicate GETs ran **in parallel** (doubling provider load).

## Root causes

| Issue | Impact |
|--------|--------|
| Telnyx reconciliation on **GET** `/api/call-handling` | Multi-second provider work on every page with switcher |
| Transovo did not **persist** verified effective handler | Every read re-asked Telnyx “what is connected?” |
| Duplicate switcher mounts | 2× (or 3×) identical API + Telnyx chains |
| `loadDashboardMetrics` in `loadShellData` | Heavy campaign aggregation on non-dashboard routes |
| Duplicate `loadWorkspace` in layout + `loadShellData` | Extra DB read per navigation |
| Voice overview primary data via client `useEffect` | Extra RTT after paint |

**Explicit non-solution:** short TTL cache of Telnyx answers. Transovo owns selected/effective handler in the database; Telnyx is authoritative only at **mutation** time.

## After — architecture

### Call handling state model

Persisted on `phoneNumber.settingsJson.callHandling`:

| Field | Role |
|--------|------|
| `activeCallHandler` | Customer selection (`mctb` \| `ai_receptionist`) |
| `effectiveCallHandler` | Last **verified** handler after successful switch |
| `lastProviderVerifiedAt` | ISO timestamp of last successful provider verify |
| `routingDrift` | Set when explicit reconcile detects mismatch (future / switch failure paths) |
| `explicitSelectionAt`, `parkedAiReceptionistAgentId`, … | Unchanged |

**Read path:** `loadCallHandlingOwnershipState` in `ownership-state.ts` uses `resolvePersistedEffectiveCallHandler()` — **no Telnyx**.

**Write path:** `setActiveCallHandler` → provision/route → `resolveEffectiveCallHandler` (Telnyx) → on success `persistVerifiedCallHandling` → subsequent reads use DB only.

### Telnyx removed from GET / navigation

Removed from:

- `loadCallHandlingOwnershipState` (moved to `ownership-state.ts`)  
- Ordinary page views and layout-loaded call-handling snapshot  

Still on:

- `PATCH /api/call-handling` (`setActiveCallHandler`) after routing mutations  
- `resolveEffectiveCallHandler` in `effective-handler.ts` (control plane only)

### Provider reconciliation boundary

- **Switch:** `PATCH /api/call-handling`  
- **Setup / provisioning:** existing MCTB and Voice V3 setup flows (unchanged)  
- **Drift:** `routingDrift` flag + user message; full explicit “reconnect” API can reuse `resolveEffectiveCallHandler` in a dedicated mutation (not wired on every GET)

### Single call-handling source in UI

- Server: `(app)/layout.tsx` loads `loadCallHandlingOwnershipState` once when `shouldShowCallHandlingSwitcher`  
- Client: `CallHandlingProvider` wraps `AppShell`; Sidebar/Header switchers use context (no mount-time fetch)  
- Fallback fetch remains for rare surfaces outside the provider  

### `loadShellData` before / after

| Before | After |
|--------|--------|
| `loadDashboardMetrics` (200 campaigns + full dashboard math) | `loadShellCreditsRemaining` (single `usageRecord` read) |
| Metrics object fully computed | Shell metrics defaults + `creditsRemaining` only |
| Workspace loaded internally only | Returns `workspace` for layout (removes duplicate `loadWorkspace` in layout) |

### Pages migrated off initial `useEffect` (primary data)

| Page | Change |
|------|--------|
| `/voice/overview` | Server `loadVoiceOverviewSummary` → `initialResult` prop; client fetch only for refresh |
| `/mctb` | Already server-loaded (`loadMctbOverview`) — unchanged |

### Instrumentation

- `src/lib/observability/nav-timing.ts`  
- `(app)/layout.tsx` logs `NAV_TIMING_MS` when `NAV_TIMING=1` or non-production  
- Sections: `auth`, `shell`, `entitlements`, `call_handling`, `total`  

### Regression tests

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-call-handling-ownership.ts
```

Asserts read path source excludes `resolveEffectiveCallHandler`, `verifyMctbTexmlIngressRoute`, and `telnyxRequest`.

## Latency expectations (hard requirements on navigation)

| Metric | Ordinary navigation (no switch) |
|--------|-----------------------------------|
| Telnyx requests from layout + GET `/api/call-handling` | **0** |
| Duplicate `/api/call-handling` from shell | **0** (context) |
| `campaign.findMany(200)` from `loadShellData` | **0** |
| Provider provision/repair on GET | **0** |

Measure in production after Coolify deploy: TTFB, count of `/api/call-handling`, Telnyx logs (operation name + duration only), shell DB query count.

## Files touched (summary)

- `src/lib/call-handling/ownership-state.ts` — read model  
- `src/lib/call-handling/set-active-call-handler.ts` — write + verify + persist effective  
- `src/lib/call-handling/phone-settings.ts`, `types.ts` — persisted fields  
- `src/components/call-handling/call-handling-context.tsx` — shared UI state  
- `src/components/call-handling/call-handling-switcher.tsx` — context-first  
- `src/app/(app)/layout.tsx`, `src/components/layout/app-shell.tsx`  
- `src/lib/workspace-data.ts` — slim shell loader  
- `src/app/(app)/voice/overview/page.tsx`, `voice-overview-dashboard.tsx`  
- `src/lib/observability/nav-timing.ts`  

## Remaining slow boundaries (>500ms possible)

- First load of heavy **page-specific** APIs (analytics, large lists) — out of scope for shell pass  
- **PATCH** call-handling switch (intentional Telnyx work)  
- Voice overview `loadVoiceOverviewSummary` still runs on server for `/voice/overview` (one DB-heavy page load, not duplicated via client waterfall)  
- Full dashboard at `/dashboard` still uses `loadDashboardMetrics` where that route loads it  

## Production deployment verification

1. Push `master` → wait for Coolify build green  
2. `GET /api/health` commit SHA  
3. Navigate Voice ↔ MCTB pages with devtools: **no** `/api/call-handling` on load when switcher visible (context); **no** Telnyx in app logs during navigation  
4. Switch handler once: Telnyx allowed; refresh; handler unchanged **without** Telnyx on read  
