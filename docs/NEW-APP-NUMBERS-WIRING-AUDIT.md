# New-app numbers wiring audit (foundation for Phone / MCTB / AI Receptionist)

**Scope:** `new-app/` UI and how it should connect to the existing Transovo monolith (`src/`) **without** auth/login work in this pass.  
**Production today:** `https://transovo.ai` serves **only** `new-app` (standalone Next). Legacy APIs live in the monolith repo but are **not** exposed on that hostname unless we add a proxy or second route.

---

## 1. What `new-app` has today (no real backend)

| Layer | Reality |
|--------|---------|
| **HTTP** | Only `GET /api/health` (new-app identity). **Zero** `fetch()` / SWR / server actions to monolith APIs. |
| **Numbers workspace** | `NumbersProvider` → in-memory React state seeded from `lib/numbers.ts` (`OWNED_SEED`, `CONNECTIONS_SEED`, `PORTS_SEED`). Survives client navigation only. |
| **Everything else** | `lib/data.ts` demo dataset (`NUMBERS`, `CALLS`, `CONTACTS`, …) used by Phone dialer, inbox, MCTB recovery, home, global search. |
| **Workspace / calls** | `WorkspaceProvider` fakes dialer calls with timers; `AgentProvider` fakes AI publish/save. |
| **Telnyx** | Not referenced. Buy/search uses `demoSearch()` in `lib/numbers.ts`. |

**Implication:** Wiring numbers is not “flip one env var.” You need (a) an **API base** the browser can call with credentials later, and (b) **adapters** that map monolith JSON → `lib/numbers.ts` types (and eventually collapse the duplicate `lib/data.ts` `NUMBERS`).

---

## 2. Two number models in the UI (must merge when wiring)

The blueprint intentionally split “Global Numbers” from “product shortcuts,” but both are mock today:

| Source | Types | Used by |
|--------|--------|---------|
| **`lib/numbers.ts`** | `OwnedNumber`, `ExternalConnection`, `PortRequest`, product assignments | `/app/numbers/*`, wizards (buy/connect/port), `NumberPicker` for receptionist/MCTB call-handling |
| **`lib/data.ts` `NUMBERS`** | Simpler `PhoneNumber` (`type: transovo \| forwarded`, `products[]`) | Dialer, calls tables, MCTB recovery lines, inbox sender, home stats, search |

**Rule for integration:** Treat **`lib/numbers.ts` as the canonical Numbers domain UI**. Product pages should read **derived views** from one adapter (or sync provider → thin `data.ts` shim) so MCTB “which line” and Numbers inventory never disagree.

---

## 3. UI surface map (numbers-first)

### Global Numbers (`/app/numbers`)

| Route | Component | Demo behavior | Monolith target (when wired) |
|-------|-----------|---------------|------------------------------|
| `/app/numbers` | `NumbersInventory` | Tabs: owned / connected / porting | Compose from multiple APIs (below) |
| `/app/numbers/new` | `buy-wizard` | `addOwned()` locally | Search + purchase Telnyx (see §5) |
| `/app/numbers/connect` | `connect-wizard` | `addConnection()`; user types `forwardsTo` | **MCTB setup phone + forwarding verification** (business line + carrier); ingress target **server-authoritative** |
| `/app/numbers/port` | `port-wizard` | `addPort()` | `GET/POST /api/numbers/port` |
| `/app/numbers/[id]` | `number-details` (owned) | rename, assignments UI | `GET/PATCH /api/numbers/[id]`, call-handling |
| `/app/numbers/connections/[id]` | connection detail | test history mock | MCTB forwarding verification + onboarding |
| `/app/numbers/ports/[id]` | port detail | milestones mock | `GET /api/numbers/port/[id]` |

### Cross-product pickers

| Component | Role |
|-----------|------|
| `NumberPicker` / `useResolvedConnection` | Receptionist + MCTB call-handling choose **owned** or **external** connection |
| `assignment-sheet` | Edits `Assignment[]` per owned number (phone / receptionist / mctb / sms) — **no monolith equivalent as one object**; maps to per-product config + `call-handling-mode` |

### Phone product duplicate entry

`/app/phone/numbers` exists in tree; primary inventory is **`/app/numbers`** per `lib/nav.ts` (Workspace → Numbers).

---

## 4. Canonical runtime concepts (monolith) vs blueprint labels

MCTB and platform messaging use **three different number roles** (do not collapse in UI or API):

| Role | Meaning | Blueprint analogue |
|------|---------|-------------------|
| **Business line** | Customer’s public number callers dial | `ExternalConnection.number` (connect flow) |
| **Forwarding destination** | Hidden toll-free **ingress** (workspace-assigned) | `ExternalConnection.forwardsTo` — must be **read-only** from API (`forwardE164` / ingress status), not a free-text demo field |
| **Text-back sender** | SMS FROM for recovery | Often **platform toll-free** (shared pool), not the business line |

**Platform number (shared):**

- Resolved server-side: `resolveSharedPlatformOutboundSender()` / `resolveCanonicalMctbPlatformSender()`.
- Exposed to UI example: `GET /api/mass-texting/sending-numbers` → `platform: { id: "__transovo_platform__", number, label: "Transovo platform number (shared)" }`.
- **Not** a row in `phoneNumber` owned by the workspace; inbound replies use platform assignment tables (`mctbPlatformSenderAssignment`, etc.).

**Owned Telnyx numbers:**

- `PhoneNumber` in Prisma; workspace-scoped.
- List: `GET /api/numbers` → `loadPhoneNumbers(workspaceId, { includeLinked: true })` via `workspace-accessible-numbers`.

**MCTB-specific phone/setup:**

- `GET /api/mctb/numbers` — setup dropdown, TFV, `provision_auto`, `select` ingress phone.
- `GET/PATCH /api/mctb/setup` — `businessLineE164`, `ingressProvisioning.forwardE164`, forwarding verification state.
- `GET /api/mctb/onboarding` — forwarding test / verification actions.
- `GET /api/mctb/shell-context` — lightweight shell fields including `businessLineE164`.

**Search (buy flow):**

- `GET /api/messaging/numbers` — Telnyx search (`messagingOnboarding.searchNumbers`).
- Premium vanity path: `/api/numbers/premium/*`.

**Porting:**

- `GET/POST /api/numbers/port`, `GET /api/numbers/port/[id]`.

**Sync / ops (usually not in customer UI v1):**

- `POST /api/numbers/sync-telnyx`, `sync-twilio`, repair routes.

---

## 5. Recommended adapter layout in `new-app` (no auth yet — structure only)

```
new-app/lib/api/
  client.ts              # base URL + credentials hook (stub until auth)
  adapters/
    numbers-owned.ts     # GET /api/numbers → OwnedNumber[]
    numbers-connections.ts  # mctb setup + forwarding → ExternalConnection[]
    numbers-ports.ts     # port API → PortRequest[]
    platform-sender.ts   # read-only PlatformSenderCard (not assignable as owned)
```

**Provider evolution:** Replace `useState(OWNED_SEED)` in `NumbersProvider` with:

1. `useEffect` load (or React Query) when session exists.
2. Optimistic updates calling PATCH/POST on wizards.
3. Single `refresh()` after connect verification / buy / port submit.

**Connect wizard critical rule:** On wire-up, **stop** letting users type arbitrary `forwardsTo`. Load `ingressProvisioning.forwardE164` from `GET /api/mctb/setup` (or shell-context) and display as “Transovo forwarding destination.”

---

## 6. Deployment blocker: API host

`transovo.ai` currently serves **only** the standalone `new-app` image. Monolith routes like `/api/numbers` are **not** on that origin.

Options (pick one before integration tests):

1. **Same-site reverse proxy** (Traefik/Coolify): `transovo.ai/api/*` → legacy web container (or dedicated API service).
2. **Explicit API origin:** `NEXT_PUBLIC_TRANSOVO_API_URL=https://…` (legacy app FQDN or internal URL) + CORS/cookies plan.
3. **BFF in new-app:** Next route handlers in `new-app/app/api/*` that server-side proxy to monolith (needs shared secret or session forwarding).

Auth is deferred per product decision, but **every** monolith route above uses `requireSession()` today — so “numbers without auth” means either dev bypass on a staging API or temporary read-only fixtures until session forwarding exists.

---

## 7. Suggested wiring order (numbers slice only)

1. **Read path:** Owned inventory — `GET /api/numbers` → Owned tab (minimal fields: id, e164, friendlyName, status, capabilities from messaging status).
2. **Read path:** Platform sender — dedicated card on Numbers overview (“Shared SMS/voice platform number”) from platform sender resolver endpoint (mass-texting or thin MCTB read).
3. **Read path:** MCTB connection — map `businessLineE164` + verification status → Connected tab (`ExternalConnection`).
4. **Read path:** Ports — `GET /api/numbers/port`.
5. **Write path:** Connect + verify — onboarding/setup forwarding APIs (after read paths stable).
6. **Write path:** Buy — search + provision (Telnyx); highest risk, after ingress/read-only proven.
7. **Unify** `lib/data.ts` `NUMBERS` consumers to read from `NumbersProvider` adapter.

---

## 8. Out of scope for this audit pass

- Login, session, workspace switcher (user: not doing auth/host now).
- Full Phone dialer / WebRTC (demo only).
- AI Receptionist agent runtime (separate APIs under voice/AR).
- MCTB operational pages (missed calls, conversations) — after numbers foundation.

---

## 9. Files to touch first (when implementation starts)

| File | Change |
|------|--------|
| `components/providers/numbers-provider.tsx` | Load from API adapter instead of seeds |
| `lib/numbers.ts` | Keep types; move seeds to `lib/fixtures/` or delete after adapter |
| `components/numbers/connect-wizard.tsx` | Ingress from API; verification actions |
| `components/numbers/buy-wizard.tsx` | `messaging/numbers` search + purchase API |
| `components/numbers/numbers-inventory.tsx` | Platform sender row + loading/error states |
| `next.config.mjs` or Coolify | API proxy strategy (§6) |

**Monolith reference (read-only):**

- `src/app/api/numbers/route.ts`
- `src/app/api/mctb/numbers/route.ts`
- `src/app/api/mctb/setup/route.ts`
- `src/app/api/mctb/onboarding/route.ts`
- `src/app/api/numbers/port/route.ts`
- `src/lib/numbers/workspace-accessible-numbers.ts`
- `src/lib/messaging/platform-outbound-sender.ts`
