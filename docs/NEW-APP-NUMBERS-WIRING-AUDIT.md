# New-app numbers wiring audit (foundation for Phone / MCTB / AI Receptionist)

**Scope:** `new-app/` UI + **new backend inside `new-app/`**, using monolith `src/` as **reference to port/copy**, not as a live HTTP dependency.  
**Production today:** `https://transovo.ai` serves **only** `new-app` (standalone Next). All new Route Handlers live under `new-app/app/api/*`.

## Integration strategy (locked for this rebuild)

| Not doing | Doing |
|-----------|--------|
| Browser calling legacy `/api/*` on another host | **Recreate** domain logic in `new-app/lib/` (copy/adapt from `src/lib/`) |
| Blocking on login UI / NextAuth parity | **Defer** customer auth; use env-scoped dev workspace or single-tenant bootstrap until product login ships |
| Running two web containers for one site | One app: UI + API + (when needed) Prisma/jobs in the **same** `new-app` deploy |

**Reference map:** When the audit says “monolith target,” read **“source files to port”** (e.g. `src/lib/numbers/*`, `src/lib/mctb/provisioning/*`, Telnyx clients)—implement equivalents under `new-app/lib/server/` and expose `new-app/app/api/numbers/*`.

**Auth note:** Ported code still needs a **workspace id** (or single workspace) for DB rows and Telnyx— that is not the same as shipping the full login product. Use `DEV_WORKSPACE_ID` / bootstrap until real auth exists.

---

## 1. What `new-app` has today (no real backend)

| Layer | Reality |
|--------|---------|
| **HTTP** | Only `GET /api/health` (new-app identity). **Zero** `fetch()` / SWR / server actions to monolith APIs. |
| **Numbers workspace** | `NumbersProvider` → in-memory React state seeded from `lib/numbers.ts` (`OWNED_SEED`, `CONNECTIONS_SEED`, `PORTS_SEED`). Survives client navigation only. |
| **Everything else** | `lib/data.ts` demo dataset (`NUMBERS`, `CALLS`, `CONTACTS`, …) used by Phone dialer, inbox, MCTB recovery, home, global search. |
| **Workspace / calls** | `WorkspaceProvider` fakes dialer calls with timers; `AgentProvider` fakes AI publish/save. |
| **Telnyx** | Not referenced. Buy/search uses `demoSearch()` in `lib/numbers.ts`. |

**Implication:** Wiring numbers means adding **`new-app/app/api/...` + server libs** (Prisma/Telnyx/env on the Coolify app when ready), then **adapters** in the client that map API JSON → `lib/numbers.ts` types (and collapse duplicate `lib/data.ts` `NUMBERS`).

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
| `/app/numbers` | `NumbersInventory` | Tabs: owned / connected / porting | `new-app` API composing ported loaders |
| `/app/numbers/new` | `buy-wizard` | `addOwned()` locally | Port Telnyx search/order from `src/lib/messaging` / numbers premium |
| `/app/numbers/connect` | `connect-wizard` | `addConnection()`; user types `forwardsTo` | Port MCTB business line + forwarding verification; ingress **server-authoritative** |
| `/app/numbers/port` | `port-wizard` | `addPort()` | Port `src/lib/numbers/port-service` → `new-app/app/api/numbers/port` |
| `/app/numbers/[id]` | `number-details` (owned) | rename, assignments UI | Port phone number PATCH + call-handling |
| `/app/numbers/connections/[id]` | connection detail | test history mock | Port forwarding verification from `src/lib/mctb/onboarding` |
| `/app/numbers/ports/[id]` | port detail | milestones mock | Port port detail route |

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

## 5. Target layout in `new-app` (port + thin client)

**Server (new):**

```
new-app/lib/server/
  db.ts                    # Prisma client (shared schema from repo prisma/ when added)
  workspace-context.ts     # resolve workspaceId (env bootstrap until login)
  numbers/
    load-owned.ts          # port from workspace-accessible-numbers + mappers
    platform-sender.ts     # port from platform-outbound-sender / mctb platform config
    connections.ts         # port MCTB business line + forwarding verification read model
    port-requests.ts       # port port-service
new-app/app/api/numbers/
  route.ts                 # GET/PATCH owned list
  port/route.ts
  connections/route.ts     # optional split
```

**Client (existing UI):**

```
new-app/lib/api/
  numbers-client.ts        # fetch('/api/numbers') — same origin, no external base URL
```

**Provider evolution:** Replace `useState(OWNED_SEED)` in `NumbersProvider` with load from `/api/numbers` + optimistic updates on wizards.

**Connect wizard:** `forwardsTo` = ingress from server config, not free text.

---

## 6. What to copy from monolith first (numbers slice)

| Port into `new-app` | Reference in repo |
|---------------------|-------------------|
| Phone list + friendly name | `src/lib/workspace-data.ts` `loadPhoneNumbers`, `src/lib/mappers.ts` `mapPhoneNumber` |
| Telnyx search (buy) | `src/lib/messaging/service` searchNumbers, number provision paths |
| Platform sender display | `src/lib/messaging/platform-outbound-sender.ts`, `src/lib/mctb/messaging/platform-sender-config.ts` |
| MCTB business line + ingress | `src/lib/mctb/provisioning/*`, `src/app/api/mctb/setup/route.ts` (logic only) |
| Forwarding verification | `src/lib/mctb/onboarding/forwarding-verification.ts` |
| Porting | `src/lib/numbers/port-service.ts` |

Add to `new-app` deploy when porting: `DATABASE_URL`, Telnyx keys, same Prisma schema (or a narrowed schema later—start shared DB for speed).

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

- Full login / workspace switcher product UI (use bootstrap workspace id in env until then).
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
