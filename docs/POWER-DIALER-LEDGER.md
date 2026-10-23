# Power Dialer — completion ledger

Last updated: Phase 10 (2026-10-23).

## Production deploy

| Item | Value |
|------|--------|
| **Phase 7 SHA (John re-test)** | `1f4f307b5d63ea1a05738390a14ea6194ab46445` |
| **Phase 8 SHA** | `2cbe7bf891c90af0d7e41a497082f026cae56242` |
| **Phase 9 SHA** | `e3f98897e00bfd32b437f0f03d78937beead6267` *(contacts bootstrap — **reverted Phase 10**)* |
| **Phase 10 SHA** | *(see `/api/health` after push)* |
| **Phase 6 migration** | `20261023180000_power_dialer_phase6` |
| **Disk (Coolify)** | ~67% on `/` (2026-10-23) |

## Phase 10 (reject mock contact bootstrap)

| # | Item | Root cause / fix | Tests | Verify |
|---|------|------------------|-------|--------|
| 1 | No fake contacts in prod | **Rejected** Phase 9 `ensureShellContactsCatalog()` — removed file + bootstrap calls. `/app/contacts` shows only real `Contact` rows; honest empty state when none. | `test:power-dialer-phase9` (asserts bootstrap removed) | **Prod:** empty → import one via list → search → delete → archive list → empty |
| 2 | Prod DB cleanup | SSH: deleted 16 `shell_catalog` rows on `ws_1` (0 refs each). `+15555550199` absent. | — | SQL below |
| 3 | Phase 9 settings tabs | **Retained** from Phase 9 — Call Screening tab leak fix + copy (unchanged this pass). | — | — |
| 4 | Billing numbers | **Mock** — unchanged (`settings-tabs.tsx` `USAGE` const). | — | Code audit |

### Shell catalog cleanup SQL (prod, 2026-10-23)

**SELECT (16 rows, all `customFields.source = shell_catalog`, `createdAt` 2026-10-23 05:42:51 UTC):**

Elena `cmvkjmzmd0001o60mjxyqv24r` +13125558821 · Marcus `cmvkjmzmd0003o60ms19xwrqe` +17735552210 · Aisha `cmvkjmzme0005o60mvcpovw5f` +13125559034 · Robert `cmvkjmzmf0007o60mzcqnj6wo` +18475551170 · Sofia `cmvkjmzmf0009o60mabj74r6y` +13125554456 · James `cmvkjmzmg000bo60mhxlex63p` +17735553389 · Hannah `cmvkjmzmh000do60m2i7r6scp` +13125557712 · Victor `cmvkjmzmi000fo60mp1ixbrx1` +16305556641 · Grace `cmvkjmzmi000ho60mvljhhk7e` +13125550987 · Derek `cmvkjmzmj000jo60mow3boskh` +17735558804 · Leila `cmvkjmzmk000lo60m9x77zo5t` +13125552267 · Owen `cmvkjmzml000no60m6wzvhkay` +18475559012 · Nadia `cmvkjmzml000po60m40rw91cz` +13125556120 · Samuel `cmvkjmzmm000ro60m8idima65` +17735557745 · Clara `cmvkjmzmn000to60mxmiae3kt` +13125553398 · Ian `cmvkjmzmn000vo60me4zv6h2t` +16305552281.

Ref counts: 0 list members, tags, `power_dialer_attempts`, `power_dialer_callbacks`, conversations, `human_calls`, messages — **all deleted** (none archived).

```sql
BEGIN;
DELETE FROM "ContactListMember" WHERE "contactId" IN (SELECT id FROM "Contact" WHERE "workspaceId" = 'ws_1' AND "customFields"::text LIKE '%shell_catalog%');
DELETE FROM "ContactTag" WHERE "contactId" IN (SELECT id FROM "Contact" WHERE "workspaceId" = 'ws_1' AND "customFields"::text LIKE '%shell_catalog%');
DELETE FROM "Contact" WHERE "workspaceId" = 'ws_1' AND "customFields"::text LIKE '%shell_catalog%';
COMMIT;
-- Result: DELETE 0 members, DELETE 0 tags, DELETE 16 contacts; ws_1 contact_count = 0
```

## Phase 9 (contacts regression + settings tabs) — superseded for item 1

| # | Item | Root cause / fix | Tests | Verify |
|---|------|------------------|-------|--------|
| 1 | `/app/contacts` empty | ~~`ensureShellContactsCatalog()`~~ **Reverted Phase 10** — see above. | `test:power-dialer-phase9` | — |
| 2 | Call Screening tab leak | Base UI tab exit transition kept vm-drops panel mounted/visible; controlled tab + conditional render + `data-[hidden]:hidden` on `TabsContent`. Copy → “Voicemail Drops tab”. | — | **Prod:** screening tab clean |
| 3 | Billing numbers | **Mock** — `USAGE` const in `settings-tabs.tsx` (not Stripe/DB). PD minutes **real** in `getPowerDialerUsageSnapshot` → analytics + session `assertDialingWithinUsageLimits`; Settings > Usage & Subscription is config only, not billing dashboard. | — | Code audit (no wire to billing tab this pass) |

## Phase 8 (John re-test follow-up)

| # | Item | Implementation | Tests | Verify |
|---|------|----------------|-------|--------|
| 1a | Contacts + list detail remove/delete | `GET/DELETE /api/contacts`; `ContactsWorkspace` (real API); list detail Remove + Delete; `deleteOrArchiveContact`; archived campaigns excluded from “Used in” | `test:power-dialer-phase8` | Code on prod; UI spot-check pending John |
| 1b | Ada/Bob DB cleanup | SSH SQL on prod `ws_1` — see report below | — | Done (2 rows deleted) |
| 2 | Dispositions “Add outcome” focus + toast | `useEffect` focus after expand; toast on add | — | Browser after deploy |
| 3 | “Used in” archived campaigns | `status: { not: "archived" }` on list detail + lists API | — | Browser after deploy |
| 4 | Scripts copy + tab labels | Call handling alignment; Voicemail Drops / Call Screening / Usage & Subscription | — | Browser after deploy |
| 5 | Plain-language settings copy | VM drops, screening, usage panels | — | Browser after deploy |
| 6a | CRM OAuth 405 | GET → 400; `CrmOAuthConnectButton` POST | `test:power-dialer-phase8` | No GET 405 during scripts test |
| 6b | Receptionist/inbox 502 | Coolify logs: no app errors; 502 likely deploy/cold start | — | `/api/receptionist` 200 post-deploy |
| 7 | Scripts “Set default” | Existing PATCH `isDefault` | — | **Browser verified** on prod (`2cbe7bf`) |

### Ada/Bob cleanup SQL (prod, 2026-10-23)

**SELECT (before delete):**

```sql
SELECT c.id, c."workspaceId", c."firstName", c."lastName", c.phone, c.company, c.status, c."createdAt"
FROM "Contact" c
WHERE c.phone LIKE '%5555550101%' OR c.phone LIKE '%5555550103%';
```

| id | workspaceId | firstName | phone | company | createdAt |
|----|-------------|-----------|-------|---------|-----------|
| cmvkg4rqv00btrv0lp97j2z1h | ws_1 | Ada | +15555550101 | ZZ | 2026-10-23 04:04:42 |
| cmvkg4slz00bxrv0lg4wg920e | ws_1 | Bob | +15555550103 | ZZ | 2026-10-23 04:04:43 |

List membership: both on archived list `ZZ-TEST` (`cmvkg4axh00brrv0lntc9pyml`). Ref counts: 0 attempts, 0 callbacks, 0 conversations, 0 human_calls.

**DELETE (transaction):**

```sql
BEGIN;
DELETE FROM "ContactListMember" WHERE "contactId" IN ('cmvkg4rqv00btrv0lp97j2z1h','cmvkg4slz00bxrv0lg4wg920e');
DELETE FROM "ContactTag" WHERE "contactId" IN ('cmvkg4rqv00btrv0lp97j2z1h','cmvkg4slz00bxrv0lg4wg920e');
DELETE FROM "Contact" WHERE id IN ('cmvkg4rqv00btrv0lp97j2z1h','cmvkg4slz00bxrv0lg4wg920e') AND "workspaceId" = 'ws_1';
COMMIT;
```

Result: `DELETE 2` members, `DELETE 2` contacts; remaining count for those phones = 0.

## Tests (VM)

| Script | Result |
|--------|--------|
| `test:power-dialer-phase6` | PASS |
| `test:power-dialer-phase7` | PASS |
| `test:power-dialer-phase8` | PASS |
| `test:power-dialer-phase9` | PASS (Phase 10: no bootstrap) |

## Final consolidated status (for John)

| Area | Status | Notes |
|------|--------|-------|
| PD Overview, Dialer, Campaigns, Lists, Callbacks, Call history, Number health | **Done + John verified** (Phase 7 on `1f4f307b`) | Session setup inconclusive without campaign |
| PD Analytics (+ subroutes) | **Done + verified** | |
| PD Integrations + detail | **Done + verified** | CRM connect POST fix in Phase 8 |
| PD Settings (11 tabs, scripts, dispositions, compliance) | **Done + mostly verified** | Phase 8: focus/toast, copy, set-default pending browser |
| CSV import preview | **Done-code** | John verified Phase 7; not re-run Phase 8 |
| Global `/app/contacts` | **Done** (Phase 10) | Real DB only; empty state honest; no shell catalog seed |
| List detail remove/delete | **Done-code** (Phase 8) | |
| ZZ test data | **Done** | User archived list/campaign; Ada/Bob deleted via SQL |
| `/app/billing` | **Not done** | 404 — out of PD scope |
| Live CRM import/writeback | **Not done** | No CRM connected on QA |
| SMS worker CRM push E2E | **Could not verify** | |

### True remaining blockers

1. **Billing route** — `/app/billing` 404 (pre-existing).
2. **Dialer session setup** — needs an active campaign in QA to exercise pre-session controls end-to-end.
3. **CRM live paths** — connect + import/writeback need a connected CRM on QA.

### Could not verify (this agent pass)

- Prod browser: Contacts search, list remove/delete UI (John quick pass).
- Transient **502** on `_rsc` during deploy — no matching errors in app logs after container warm; treat as cold start unless reproduced on stable SHA.

## Phase 7 (historical)

| # | Defect | John re-test on `1f4f307b` |
|---|--------|----------------------------|
| 1–11 | Acceptance list | **Passed** (per John) |
| 12 | ZZ-TEST + test contacts | Partial — user cleaned artifacts; Ada/Bob removed Phase 8 SQL |
