# New-app Phone product wiring audit

**Scope:** Every **Phone** route, screen, and interactive surface in `new-app/`, plus **global shell** pieces that exist primarily for Phone (active call bar, header dialer, click-to-call).  
**Companion:** `docs/NEW-APP-NUMBERS-WIRING-AUDIT.md` (inventory, buy/connect/port — partially implemented under `/api/numbers/*`).  
**Production:** `https://transovo.ai` serves **only** `new-app`. Legacy `src/app/api/*` is **reference to port**, not a live dependency.

## Integration strategy (same as Numbers audit)

| Not doing | Doing |
|-----------|--------|
| Browser calling legacy `/api/*` on another host | Port domain logic into `new-app/lib/server/` + `new-app/app/api/phone/*` (and shared call-history where appropriate) |
| Blocking on full login / NextAuth | Bootstrap workspace via `DEV_WORKSPACE_ID` / `lib/server/workspace.ts` until auth ships |
| Two web containers | One deploy: UI + API + Prisma on greenfield DB (`docs/NEW-APP-DATABASE-GREENFIELD.md`) |

**Status legend**

| Status | Meaning |
|--------|---------|
| **Mock** | `lib/data.ts` or in-memory React only; no persistence |
| **Simulated** | UI state machine with timers (not Telnyx/media) |
| **Toast-only** | Button shows toast; no create/update API |
| **Partial** | Real API exists elsewhere (e.g. numbers) but Phone UI does not use it yet |
| **Target** | Monolith reference identified for port |

---

## 1. What `new-app` has today (Phone-specific HTTP)

| Layer | Reality |
|--------|---------|
| **Phone APIs** | **None.** No `new-app/app/api/phone/*`. |
| **Related APIs** | `GET /api/health`, `GET|POST /api/numbers/*` (inventory, search, purchase, PATCH) — **not consumed** by Phone dialer/overview (still `lib/data.ts` `NUMBERS`). |
| **Call history** | `CALLS` array in `lib/data.ts`; `getCall(id)` on server for detail pages. |
| **Live calling** | `WorkspaceProvider.startCall` — fake connecting → ringing → live; `ActiveCallBar` labeled **Simulated**. |
| **Routing policy** | `RoutePolicy` in `WorkspaceProvider` — seeded from `ROUTE_POLICY_DEFAULT`; save updates React state only. |
| **Metrics / analytics** | `phoneMetrics()`, `PHONE_TREND`, `HOURLY_VOLUME`, hardcoded teammate table — all from fixtures. |
| **Power dialer** | `CAMPAIGNS`, `LISTS`, `DIALER_QUEUE` fixtures; dispositions/session log are local state only. |

---

## 2. Phone nav and routes (canonical)

From `new-app/lib/nav.ts` (product **phone**):

| Route | Page | Primary components |
|-------|------|-------------------|
| `/app/phone` | Overview | `phone/page.tsx`, `RecentCalls`, `RoutingSummary`, stats from `phoneMetrics()` |
| `/app/phone/dialer` | Dialer | `Dialer` |
| `/app/phone/power-dialer` | Power dialer | `PowerDialer` (tabs: Session, Campaigns, Lists) |
| `/app/phone/calls` | Call list | `CallsTable` variant `phone` |
| `/app/phone/calls/[id]` | Call detail | `CallDetail`, `CallActions`, `CallNotes` |
| `/app/phone/call-handling` | Routing editor | `PhoneRoutingEditor`, `RoutingSummary`, `BusinessHours` |
| `/app/phone/analytics` | Analytics | charts + `RangeSelect` (UI-only range) |
| `/app/phone/numbers` | Redirect | → `/app/numbers` |

**Legacy shortcut:** `/app/calls/[id]` renders the same `CallDetail` with breadcrumb back to Phone calls (not a separate product).

---

## 3. Screen-by-screen audit

### 3.1 Overview (`/app/phone`)

| UI region | Current data / behavior | Backend needed | Monolith reference (port) | Priority |
|-----------|-------------------------|----------------|---------------------------|----------|
| Eyebrow “Lines active” | Static success badge | Derive from numbers + forwarding + softphone readiness | `GET /api/phone/readiness`, number/messaging status | P1 |
| Default caller ID in header | `NUMBERS[0]` mock | Default caller ID from phone settings + owned numbers | `GET/PATCH /api/phone/settings` (`defaultCallerIdNumber`) | P1 |
| KPI strip (inbound, outbound, missed, voicemail, talk time) | `phoneMetrics()` on `CALLS` | Aggregated CDR/query over `humanCall` +/or unified `voiceCall` for AI-attributed legs | `GET /api/phone/calls` + analytics aggregation | P1 |
| Recent calls | `CALLS.slice(0,7)`; row links use `basePath` prop | Paginated call list API; fix links to `/app/phone/calls/:id` | `GET /api/phone/calls` | P1 |
| Routing summary | `WorkspaceProvider.routePolicy` | Persisted call-handling + business hours per line | `src/lib/call-handling/*`, workspace settings JSON | P2 |
| Needs follow-up list | Filter `CALLS` for voicemail/callback + `!handled` | Call disposition / callback flags on `humanCall` or CRM notes | `PATCH /api/phone/calls/[id]`, CRM route | P2 |
| Power dialer card | `CAMPAIGNS` mock | **No dedicated monolith power-dialer API found** — treat as greenfield or defer | Marketing copy in `src/lib/outcomes/phone-solutions.ts` only | P4 / defer |
| Numbers panel | `lib/data.ts` `NUMBERS` | Same as Numbers product: `GET /api/numbers/inventory` | Already in `new-app` | P1 |
| Works with Phone links | Static hrefs to receptionist/MCTB | Entitlement + setup readiness only (navigation) | Product flags | P3 |

**Popups / modals:** None on this page.

**Known UX bug (fix in UI):** Overview passed `basePath="/app/calls"` and follow-up links to `/app/calls/:id` while list “view all” correctly uses `/app/phone/calls`.

---

### 3.2 Dialer (`/app/phone/dialer`)

| Control | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Number input + keypad | Local state | — | — | — |
| Contact suggestions | `CONTACTS` filter | `GET /api/contacts` search | Contacts APIs in `src/` | P2 |
| Blocked caller | `contact.status === 'blocked'` | Suppression / DNC on contact | Contacts + compliance | P2 |
| Call from (caller ID) | `NUMBERS` with `products.includes('phone')` | Owned numbers + default from settings | `/api/phone/settings`, `/api/numbers` | P1 |
| **Call** button | `startCall()` simulated | Outbound dial: WebRTC token + `POST /api/phone/calls` or human-call-service | `src/app/api/phone/calls/route.ts` POST, `webrtc-token`, `human-call-service` | P0 |
| Recent outbound list | `CALLS` filter | Same list API as calls page | `GET /api/phone/calls?direction=outbound` | P1 |
| Query param `?to=` | `initialTo` from contacts table | — | — | — |

**Popups:** Inline suggestion dropdown only (not a modal).

**Global:** `ActiveCallBar` — mute/hold/end are **Simulated**; need Telnyx WebRTC / Call Control + presence.

---

### 3.3 Power dialer (`/app/phone/power-dialer`)

| Tab / control | Current | Backend needed | Notes | Priority |
|---------------|---------|----------------|-------|----------|
| **Session** — queue | `DIALER_QUEUE` + `CAMPAIGNS[0]` | Campaign + queue models, eligibility (opt-out, timezone) | No production power-dialer module found in `src/`; likely **new domain** or mass-texting lists reuse | P4 |
| Dial / Skip / Pause | Local index + simulated `startCall` | Progressive/preview dial orchestration + disposition persist | — | P4 |
| Disposition chips | Local state → session log | Write disposition per attempt | Partial analog: `humanCall.disposition` | P4 |
| Notes | Local textarea | Note on call or campaign attempt | `POST` notes on call / CRM | P4 |
| **Campaigns** — New campaign | Toast only | CRUD campaigns | Greenfield | P4 |
| Campaign list | `CAMPAIGNS` mock | List + progress % from attempts | Greenfield | P4 |
| **Lists** — Import CSV | Toast only | List import API (contacts) | Contacts lists in monolith | P3 |
| Lists table | `LISTS` mock | List metadata + eligible counts | Contacts | P3 |

**Popups:** None (toasts stand in for wizards).

**Recommendation:** Ship Phone MVP **without** power dialer backend; keep UI as demo or gate behind flag until product scope is confirmed.

---

### 3.4 Calls list (`/app/phone/calls`)

| Control | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Segmented filters | Client filter on `CALLS` | Query params: direction, status, disposition, needs_follow_up | `GET /api/phone/calls` query params | P1 |
| Filter by number | `NUMBERS` ids | `phoneNumberId` or E.164 filter | Same | P1 |
| Search | Client string match | Server `q` on from/to/notes | `GET /api/phone/calls?q=` | P1 |
| Pagination | Client slice (12/page) | Cursor/offset from API | Same | P1 |
| Row → detail | Link to `basePath/:id` | `GET /api/phone/calls/[id]` | `src/app/api/phone/calls/[id]/route.ts` | P1 |
| AI / MCTB badges on rows | Fields on mock `Call` | Join or embed voice/MCTB recovery on unified call read model | `voiceCall`, MCTB missed-call APIs | P2 |

**Popups:** None.

**URL:** `?filter=` from overview stats links — supported via `initialFilter`.

---

### 3.5 Call detail (`/app/phone/calls/[id]`)

| Section | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Header + outcomes | Mock `Call` | Single call record + linked products | `GET /api/phone/calls/[id]` | P1 |
| Mark handled / Reopen | Local `useState` only | Persist handled flag | PATCH call or task | P2 |
| Call back | `startCall` simulated | Outbound dial API | `POST /api/phone/calls` | P0 |
| AI summary / transcript / tools | Mock nested `call.ai` | Voice AI call payload | `src/app/api/voice/calls/[id]` (different product leg — unify in read model) | P2 |
| Voicemail transcript | Mock text | Voicemail + STT | `GET /api/phone/voicemail`, recording routes | P2 |
| MCTB panel | Mock `call.mctb` | Missed-call recovery state | MCTB detail APIs (port later) | P3 |
| Recording panel | Placeholder copy | Signed recording URL | `GET /api/phone/calls/[id]/recording` | P2 |
| Internal notes | Local array in `CallNotes` | Team notes per call | `crm` route or notes field | P2 |
| Contact sidebar | `getContact` mock | Contacts API | Contacts | P2 |
| Activity timeline | Built from mock fields | Authoritative event stream | `GET /api/phone/calls/[id]/events` | P2 |

**Popups:** None.

---

### 3.6 Call handling (`/app/phone/call-handling`)

| Panel | Current | Backend needed | Monolith reference | Priority |
|-------|---------|----------------|-------------------|----------|
| During hours / ring group / timeout | Draft in component; save → `updateRoutePolicy` | Per-number routing: ring groups, users, strategies | IVR/queues: `src/app/api/phone/queues`, `ivr` | P2 |
| Fallbacks (no answer, after hours) | Mock options | Business hours + after-hours destination | Call-handling compile + Telnyx handler | P2 |
| Voicemail greeting textarea | **Local `useState` only** — not in `RoutePolicy`; not saved on Save | Greeting asset / TTS config | Voicemail + receptionist greeting pipelines | P3 |
| Sticky save bar | Toast success | PATCH workspace phone/call-handling settings + provider sync | `src/lib/call-handling/*`, `setActiveCallHandler` | P2 |
| Sidebar `RoutingSummary` | Reads shared `routePolicy` | Same persisted policy | Same | P2 |
| `BusinessHours` | `BUSINESS.hours` from `lib/data.ts` | Workspace business profile | Settings / business hours APIs | P2 |
| Link “AI coverage” | Nav to receptionist call-handling | AI coverage is separate facet (`aiCoverage` on policy) | Receptionist wizard / publish | P3 |

**Popups:** None.

**Architecture note:** Blueprint shows **one shared policy** consumed by Phone, AI Receptionist, and MCTB. Monolith splits **call-handling mode** (MCTB vs AI) from **IVR/queue** details — port needs a single **read model** for `new-app` UI.

---

### 3.7 Analytics (`/app/phone/analytics`)

| Control | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| `RangeSelect` | Changes local state only; **charts ignore range** | Date range query + TZ | Analytics services on voice/phone CDR | P2 |
| Totals + trends | `PHONE_TREND` | Time-bucket aggregation | Custom metrics job or SQL | P2 |
| Busiest hours | `HOURLY_VOLUME` | Hour-of-day aggregation | Same | P3 |
| By teammate table | Hardcoded `userRows` | Per-user talk time from `humanCall` + user ids | Phone analytics in monolith if any | P3 |

**Popups:** None.

---

## 4. Global shell and cross-product surfaces (Phone-related)

| Surface | Location | Current | Backend needed | Priority |
|---------|----------|---------|----------------|----------|
| **Active call bar** | `app-shell.tsx` | Simulated call; mute/hold/end | WebRTC session + call control | P0 |
| **Header “Dial”** | `app-header.tsx` | Link to dialer | — | — |
| **Global search** | `global-search.tsx` | Mock calls/contacts; power dialer campaign link | Search API | P3 |
| **Inbox thread** | `thread-workspace.tsx` | Call button → `startCall` | Same as dialer | P1 |
| **Contacts table** | `contacts-table.tsx` | Navigate to dialer `?to=` | Contacts + dial | P2 |
| **Settings → Phone & audio** | `settings-tabs.tsx` | Toggles (record, transcribe, noise) — **no save** | `GET/PATCH /api/phone/settings` or workspace prefs | P3 |
| **Settings → Notifications** | callbacks/missed/integration | Toggles only | Notification preferences API | P3 |

**Popups:** `notifications-popover`, `global-search` overlay — not Phone-specific; no telephony backend.

---

## 5. Data model split (important for integration)

The blueprint **`Call`** type in `lib/data.ts` is a **unified story** (human leg + optional `ai` + optional `mctb` + voicemail). The monolith today uses overlapping stores:

| Concept | Monolith (typical) | Blueprint UI |
|---------|-------------------|--------------|
| Human / softphone calls | `humanCall` | Outbound/inbound answered, disposition, recording |
| Voice AI / receptionist | `voiceCall` + events | `call.ai` block |
| MCTB missed call | MCTB domain + `voiceCall` ingress | `call.mctb` block |

**Target for `new-app`:** One **call history read API** that returns the blueprint shape (or a thin mapper), backed by joins — do not make the UI call three separate products for one row.

---

## 6. Suggested `new-app` API layout (Phone slice)

```
new-app/app/api/phone/
  readiness/route.ts          # lines, WebRTC, permissions
  settings/route.ts           # default caller ID, recording prefs
  calls/route.ts              # GET list, POST outbound / merge
  calls/[id]/route.ts         # GET one, PATCH disposition/handled
  calls/[id]/events/route.ts
  calls/[id]/recording/route.ts
  webrtc-token/route.ts       # Telnyx credential
  voicemail/route.ts          # optional phase 2
  queues/route.ts             # optional — call handling depth
new-app/lib/server/phone/
  human-calls.ts              # port from src/lib/phone/human-call-service.ts
  map-call-detail.ts          # mock Call → API DTO alignment
  metrics.ts                  # overview + analytics aggregates
```

Auth: reuse workspace bootstrap until session middleware is ported from `src/lib/api-auth.ts`.

---

## 7. Recommended wiring order (Phone MVP)

1. **Unify numbers for Phone UI** — Replace `lib/data.ts` `NUMBERS` in dialer/overview/calls filter with `NumbersProvider` / `GET /api/numbers/inventory` (assign `phone` product flag).
2. **Call list + detail read path** — Port `GET` handlers + Prisma `humanCall` (and mapper for blueprint fields); SSR or client fetch on calls pages.
3. **Phone settings** — Default caller ID + recording toggles (`/api/phone/settings`).
4. **Real outbound dial** — WebRTC token + `POST /api/phone/calls`; replace `WorkspaceProvider` simulation; drive `ActiveCallBar` from provider events.
5. **Inbound ring / presence** — `readiness`, `presence`, queue routing (larger slice).
6. **Call handling persist** — Port call-handling block + IVR/queue subset; wire `PhoneRoutingEditor` save.
7. **Analytics** — Wire `RangeSelect` to API; replace fixture charts.
8. **Enrich detail** — Recordings, events, notes, voice/MCTB enrichment.
9. **Power dialer** — Product decision; then greenfield APIs or explicit deferral.

---

## 8. Files to touch first (implementation)

| File | Change |
|------|--------|
| `components/providers/workspace-provider.tsx` | Real call session from phone API / WebRTC adapter |
| `components/phone/dialer.tsx` | Fetch caller IDs; invoke dial API |
| `components/calls/calls-table.tsx` | SWR/fetch calls; server-side filters |
| `app/app/phone/calls/[id]/page.tsx` | Fetch call by id (not `getCall` from fixtures) |
| `components/calls/call-actions.tsx` | PATCH handled; real callback dial |
| `components/calls/call-notes.tsx` | Persist notes |
| `components/routing/phone-routing-editor.tsx` | Load/save policy API; persist greeting |
| `app/app/phone/page.tsx` | Metrics + numbers from API; correct deep links |
| `lib/metrics.ts` | Accept API-fed calls or server aggregates |

**Monolith reference (read-only):**

- `src/app/api/phone/calls/route.ts`
- `src/app/api/phone/calls/[id]/route.ts`
- `src/app/api/phone/calls/[id]/events/route.ts`
- `src/app/api/phone/calls/[id]/recording/route.ts`
- `src/app/api/phone/settings/route.ts`
- `src/app/api/phone/readiness/route.ts`
- `src/app/api/phone/webrtc-token/route.ts`
- `src/lib/phone/human-call-service.ts`
- `src/lib/call-handling/phone-settings.ts`
- `src/app/api/voice/calls/*` (enrichment for AI legs)

---

## 9. Out of scope for Phone MVP (keep UI, hide or demo)

- Full power dialer campaigns (no monolith backend located).
- Conference, park, admin (`src/app/api/phone/conference`, `park`, `admin`).
- Full IVR builder UI (monolith has `ivr` routes).
- Porting MCTB/receptionist **setup** on this pass — only **links** and call-record enrichment.

---

## 10. Definition of done (Phone product wired)

Not “pages render.” Done when:

- Caller ID and lines reflect **greenfield DB + Telnyx** inventory.
- Outbound dial from dialer/detail/inbox places a **real** call (or documented env-blocked with readiness UI).
- Calls list/detail load from **API**; filters and pagination match server.
- Mark handled / disposition / notes **persist** and survive reload.
- Call handling save **persists** and matches runtime routing (or shows explicit “pending provider sync”).
- Overview KPIs and analytics use **real aggregates** for selected date range.
- No primary navigation points at **orphan** `/app/calls` paths for Phone workflows.
