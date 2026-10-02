# MCTB fresh-customer production onboarding test

**Purpose:** Create a **brand-new** MCTB customer through the **production browser UI** (not API/DB bootstrap), configure **Existing Consent** + **Transovo platform sender**, allow **normal ingress provisioning**, and stop at **carrier forwarding + live test** for the owner.

**Business number (owner configures CFNA later):** `571-477-6175` → E.164 `+15714776175`

---

## Critical rules (do not cheat)

- No `smoke-signup`, Prisma, SQL, seed scripts, or provisioning libraries to **create** the customer.
- Browser only: click, type, checkboxes, submit, wait for provisioning.
- DB/API/Telnyx **after** UI actions: **read-only verification** only.
- Do not set `trialActivatedAt`, forwarding verified, or live-test flags manually.
- Do not modify `ws_1`.

---

## Automation harness (repo)

```bash
MCTB_PROD_CERT_BASE_URL=https://<production-host> \
MCTB_FRESH_SIGNUP_MOBILE=+1<mobile-that-receives-signup-SMS> \
# optional if you already have the 6-digit code:
# MCTB_FRESH_SIGNUP_OTP=123456 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-fresh-customer-production-onboarding.ts
```

Artifacts: `/opt/cursor/artifacts/mctb-fresh-customer-onboarding/`

Report JSON: `fresh-customer-report-latest.json`

### Signup SMS OTP

Email signup requires **SMS verification** (`/api/auth/phone/send-code`). The code is **not** returned in the API response.

- Set `MCTB_FRESH_SIGNUP_MOBILE` to a phone that can receive the Telnyx OTP SMS.
- The script can poll Telnyx `GET /v2/messages?filter[to]=...` when `TELNYX_API_KEY` is available, or use `MCTB_FRESH_SIGNUP_OTP`.

### Bypass 2 (fresh-customer cert lane)

Production keeps **`DEV_AUTH_BYPASS=1`** for existing Matrix certification (`ws_1`). Do **not** disable it.

Add a **second** lane (auth only):

| Variable | Purpose |
|----------|---------|
| `DEV_AUTH_BYPASS_2=1` | Enable `GET /api/auth/dev-bypass-2` |
| `DEV_AUTH_BYPASS_2_EMAIL` | Separate user (default `mctb-fresh-cert@transovo.test`) — **must not** equal `DEV_AUTH_BYPASS_EMAIL` |
| `DEV_AUTH_BYPASS_2_FORBIDDEN_WORKSPACE_IDS` | Optional; defaults to `MCTB_PROD_CERT_WORKSPACE_ID` / `ws_1` |

Bypass 2 may create a **user row only** (no MCTB bootstrap). The harness then opens `/api/products/open?product=voice` and completes the wizard in the browser.

```bash
MCTB_PROD_CERT_BASE_URL=... \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-fresh-customer-production-onboarding.ts
```

Fails immediately if resolved workspace is `ws_1` or if `DEV_AUTH_BYPASS_2` is off on the server.

---

## Manual wizard checklist (browser)

Start: `/signup?product=mctb` (or marketing entry → Business → MCTB).

| Stage | Action | Expected |
|-------|--------|----------|
| Account | Business workspace, verify mobile SMS, create account | New workspace ID assigned (report actual ID, do not force `ws_2`) |
| First run | Land on `/mctb` modal wizard (Stage 2) | MCTB bootstrap runs (ingress provisioning) |
| Business | Name + **571-477-6175** | Forwarding number row shows **new** ingress for **this** workspace |
| Consent | **I already have consent** + all attestations | `existing_consent` persisted |
| Text Back | Platform sender / default platform template | No customer-owned A2P |
| Voicemail / Notifications | Defaults, Continue | — |
| Connect Phone | Record displayed **forward-to** number | **BLOCKED_EXTERNALLY** until carrier CFNA |
| Test & Go Live | Do not fake live test | **BLOCKED_EXTERNALLY** until real call |

---

## Read-only verification (after UI)

Using `WORKSPACE_ID=<new>`:

```bash
WORKSPACE_ID=<new> NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-ws1-config-snapshot.ts
```

Confirm:

| Check | Expected |
|-------|----------|
| `loadMctbConsentMode` | `existing_consent` |
| Sender | Platform (`senderMode` / platform sender active) |
| Business line | `+15714776175` on **this** workspace |
| Ingress | Dedicated toll-free on **this** workspace, **not** `ws_1`’s number |
| TeXML | Normal frozen MCTB ingress path (`texmlHandlerMode` for existing consent) |
| Activation | Incomplete only due to forwarding / live test |

**Note:** `+15714776175` may already be on `ws_1` (cert workspace). A second workspace using the same public business line may be **rejected or conflict** — if so, document as product boundary (do not DB-fix).

---

## Owner handoff template

Fill after successful browser run:

### New customer

- **Email:**
- **Workspace ID:**
- **Plan:**
- **Business number:** +15714776175

### Provisioning

- **MCTB ingress (forward here):**
- **Provisioning status:**
- **Belongs to new workspace:** yes/no

### Messaging

- **Consent:** existing_consent
- **Attestation:** completed in UI
- **Sender:** Transovo platform
- **Template:** platform recovery opener
- **Recovery:** enabled / paused

### Wizard stages

| Stage | PASS / BLOCKED_EXTERNALLY / FAIL |
|-------|----------------------------------|
| Signup | |
| Business | |
| Consent | |
| Text Back | |
| Voicemail | |
| Notifications | |
| Connect Phone | |
| Test & Go Live | |

### Exact owner action

```
FORWARD 571-477-6175 TO: [NEWLY PROVISIONED NUMBER]
```

Use the **forwarding type** shown in the UI for the carrier you select (do not invent star codes unless the UI shows them).

### After you configure forwarding

1. Call **571-477-6175** from another phone; let it go unanswered per your CFNA rule.
2. Carrier forwards to the **new** Transovo ingress.
3. Transovo resolves the **new** workspace.
4. **Existing Consent** path — **no Press-1**.
5. Voicemail/missed-call path completes.
6. Eligibility runs → recovery SMS via **platform sender**.
7. SMS on caller phone; row in **Missed Calls / Conversations**.
8. Notifications if configured.

**Live test in UI:** If the product requires **Test & Go Live** / `trialActivatedAt` after forwarding evidence, return to the wizard **Connect / Test** step and complete the **in-app live test** the UI describes (do not mark complete via DB).

---

## Cloud Agent attempt (2026-10-02)

- Harness added: `scripts/mctb-fresh-customer-production-onboarding.ts`
- Production cert URL with `DEV_AUTH_BYPASS=1`: **cannot reach `/signup`** — redirected to `ws_1` Overview.
- **Next step for owner:** run manual signup on production **without** bypass, or temporarily disable bypass on a staging clone, then run the harness or manual checklist above.

---

## Scope (out of bounds)

- No full MCTB audit, settings cert rerun, Voice V3, TeXML runtime changes, or `ws_1` changes.
- No `smoke-signup` for this test.
