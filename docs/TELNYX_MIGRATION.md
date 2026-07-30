# Twilio → Telnyx Migration Report (Transovo AI)

**Date:** July 30, 2026  
**Status:** Audit complete. No Twilio code removed. Phase 1 (provider abstraction) follows this report.  
**Risk context:** No production Twilio customers or live numbers in active use. Migration can prioritize **native Telnyx APIs** over Twexit compatibility.

---

## 1. Every Twilio-related file and dependency found

### Dependency
- `twilio` `^6.0.2` in `package.json` (resolved 6.0.2)

### Core messaging (live / mock)
| File | Role |
|------|------|
| `src/lib/messaging/twilio-client.ts` | Parent/subaccount Twilio clients + signature validation |
| `src/lib/messaging/twilio-adapter.ts` | Live: subaccounts, numbers, TrustHub, brand, Messaging Service, A2P, `messages.create` |
| `src/lib/messaging/twilio-config.ts` | Live gate, credentials, webhook URLs, TrustHub policy SIDs |
| `src/lib/messaging/twilio-mappings.ts` | Form → TrustHub/A2P enums |
| `src/lib/messaging/mock-adapter.ts` | Fake SIDs for local/demo |
| `src/lib/messaging/registration-processor.ts` | A2P state machine + `sendViaRegistration` |
| `src/lib/messaging/service.ts` | Onboarding actions |
| `src/lib/messaging/status.ts` | Ready-to-send gate |
| `src/lib/messaging/store.ts` | Registration CRUD |
| `src/lib/messaging/crypto.ts` | Encrypt subaccount tokens |
| `src/lib/messaging/enqueue-advance.ts` | Registration advance jobs |
| `src/lib/messaging/types.ts` | Action/job types |
| `src/lib/messaging/template.ts` | Template merge |

### Send paths
| File | Role |
|------|------|
| `src/lib/sms/send-quick.ts` | One-off SMS |
| `src/lib/sms/provider.ts` | Unused facade (`StubSmsProvider` / `TwilioIsvSmsProvider`) |
| `src/lib/campaigns/campaign-message-send.ts` | Campaign SMS + retries |
| `src/lib/campaigns/campaign-processor.ts` | Schedule / enqueue |
| `src/lib/campaigns/sequence-runner.ts` | Sequence waits / reconcile |
| `src/lib/campaigns/enroll-campaign.ts` | Enroll + E164 |

### Webhooks
| File | Role |
|------|------|
| `src/app/api/twilio/inbound/route.ts` | Inbound SMS, STOP/START/HELP, TwiML |
| `src/app/api/twilio/message-status/route.ts` | Delivery receipts |
| `src/app/api/twilio/compliance-status/route.ts` | TrustHub/brand callbacks |

### APIs / workers / docs
| File | Role |
|------|------|
| `src/app/api/sms/send/route.ts` | Quick send |
| `src/app/api/messaging/registration/route.ts` | Registration actions |
| `src/app/api/messaging/numbers/route.ts` | Number search |
| `src/app/api/jobs/process/route.ts` | Cron drain |
| `src/lib/jobs/job-handlers.ts` | Registration + campaign jobs |
| `scripts/worker-all.ts` | Worker entry |
| `docs/TWILIO_ISV_MESSAGING.md` | Twilio ISV guide |
| `.env.example` | Twilio env stubs |

### Schema
- `prisma/schema.prisma` — `PhoneNumber.twilioSid`, `MessagingRegistration` Twilio SIDs, `Message.providerId`
- `supabase/schema.sql`, `bootstrap.sql`, `fresh-install.sql`

### UI
- Numbers/compliance pages are largely **mock** (not wired to live messaging APIs).
- Admin billing uses hardcoded “Twilio cost” estimates only.
- Landing/legal STOP/HELP copy is provider-agnostic.

**No Telnyx code exists today.**

---

## 2. Current messaging architecture

```
Customer workspace
  └─ MessagingRegistration (1:1 workspace)
       ├─ Twilio subaccount (live) or mock SIDs
       ├─ TrustHub secondary profile → Brand → Messaging Service → A2P campaign
       └─ Dedicated PhoneNumber (twilioSid + E164)

Outbound:
  Quick send / campaign jobs
    → ready gate (approved + service + number)
    → suppression check
    → sendViaRegistration
    → twilio.messages.create({ messagingServiceSid, to, body, statusCallback })
    → store provider MessageSid on Message / CampaignMessage

Inbound:
  Twilio POST /api/twilio/inbound (form + X-Twilio-Signature)
    → resolve workspace by To number
    → STOP/START/HELP + suppression
    → inbox Message row
    → TwiML response

Status:
  Twilio POST /api/twilio/message-status
    → update by providerId = MessageSid
```

**Isolation rule already present:** one registration + dedicated number per workspace. That maps cleanly to Telnyx’s “one messaging profile + one number + one brand + one campaign per customer.”

---

## 3. Exact migration approach

**Recommended: native Telnyx first** (not Twexit-first).

Why:
- Transovo has no live Twilio production load to preserve.
- Twexit only helps **send/receive message API shape**; it does **not** replace number buy, messaging profiles, or 10DLC brand/campaign APIs.
- The hard ISV work is already Twilio-specific (TrustHub/subaccounts) and must be rebuilt for Telnyx anyway.

**Approach:**
1. Introduce a `MessagingProvider` interface.
2. Keep existing Twilio adapter behind it (rollback / reference).
3. Implement `TelnyxProvider` as the new default when `MESSAGING_PROVIDER=telnyx`.
4. Add additive, provider-neutral DB columns; keep old Twilio SID columns temporarily.
5. Add Telnyx webhooks under `/api/telnyx/*` (do not delete `/api/twilio/*` until Phase 5).
6. Keep UI the same; only swap the provider behind registration + send + webhooks.
7. Single main Telnyx account; per-customer resources inside that account (no managed subaccounts for MVP).

---

## 4. Features that can use Twexit (optional / temporary)

Twexit (`POST https://api.telnyx.com/2010-04-01/Accounts/{org_id}/Messages.json` with Basic auth org_id:api_key) can approximate:

| Feature | Twexit fit |
|---------|------------|
| Outbound SMS `From`/`To`/`Body` | Yes, after number + messaging profile exist |
| Inbound webhooks in Twilio form format | Possible if messaging profile API version = Twexit |
| Status callbacks in Twilio-like form | Possible with Twexit profile settings |

**Do not use Twexit for:**
- Number search/purchase
- Messaging profile creation
- 10DLC brand/campaign create/status
- Campaign ↔ number assignment
- Native Telnyx JSON webhook verification (Ed25519 / public key) when using v2 APIs

**Decision:** Implement native Telnyx Messaging API v2 for outbound. Optionally keep a Twexit send helper as an experiment behind a flag (`TELNYX_USE_TWEXIT=true`) — not required for MVP.

---

## 5. Features that require native Telnyx APIs

| Capability | Telnyx API |
|------------|------------|
| Create messaging profile (per customer) | Messaging Profiles API |
| Search / order phone numbers | Number Search + Number Orders |
| Assign number → messaging profile | Phone Numbers messaging settings |
| Create 10DLC brand | `POST /v2/10dlc/brand` |
| Create 10DLC campaign | `POST /v2/10dlc/campaignBuilder` |
| Assign number → campaign | `POST /v2/10dlc/phoneNumberCampaign` |
| Brand/campaign status polling + events | 10DLC GET + Event Notifications |
| Outbound SMS/MMS (preferred) | `POST /v2/messages` |
| Inbound + delivery webhooks | Messaging profile webhooks (JSON) + signature verify |
| Webhook auth | Telnyx public key / ED25519 verification |

Official 10DLC flow: Brand → Vetting → Campaign → Assign numbers (numbers must already be on a messaging profile).

---

## 6. Database changes (additive — do not drop Twilio columns yet)

Add provider-neutral fields on `messaging_registrations` (and mirror in phone numbers where useful):

| New field | Purpose |
|-----------|---------|
| `messaging_provider` | `twilio` \| `telnyx` \| `mock` |
| `messaging_profile_id` | Telnyx messaging profile id |
| `phone_number_id` | Telnyx phone number id |
| `phone_number` | E.164 (may mirror `phoneE164`) |
| `brand_id` | Telnyx brand id (keep `brandSid` temporarily) |
| `campaign_id` | Telnyx campaign id (keep `a2pCampaignSid` temporarily) |
| `brand_status` | Provider-normalized brand status |
| `campaign_status` | Provider-normalized campaign status |
| `messaging_activation_status` | See statuses below |
| `registration_submitted_at` | Timestamp |
| `registration_approved_at` | Timestamp |
| `registration_failure_reason` | Human-readable failure |

Suggested `messaging_activation_status` values:
`draft`, `needs_corrections`, `ready_for_submission`, `brand_submitted`, `brand_pending`, `brand_approved`, `campaign_submitted`, `campaign_pending`, `approved`, `rejected`, `suspended`

Retain: `twilioSid`, `subaccountSid`, `messagingServiceSid`, `brandSid`, `a2pCampaignSid`, etc. for rollback/audit until Phase 5.

---

## 7. Environment variable changes

### Keep (temporary)
All existing `TWILIO_*` vars until Phase 5.

### Add
```bash
MESSAGING_PROVIDER=telnyx          # mock | twilio | telnyx
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=                 # webhook signature verification
TELNYX_ORG_ID=                     # optional; for Twexit / whoami
# TELNYX_WEBHOOK_SECRET=           # only if Telnyx docs require a separate secret
# TELNYX_API_BASE_URL=https://api.telnyx.com/v2
# TELNYX_DEFAULT_MESSAGING_PROFILE_ID=   # platform admin only — NEVER shared customer send
# TELNYX_CONNECTION_ID=
# TELNYX_APPLICATION_ID=
# TELNYX_USE_TWEXIT=false
```

Rules:
- Never expose API keys to the browser.
- Never use a shared trial/platform number for customer sending.
- No Platform Free Trial messaging path.

---

## 8. Webhook changes

| Current (Twilio) | New (Telnyx) |
|------------------|--------------|
| `POST /api/twilio/inbound` form + `X-Twilio-Signature` + TwiML | `POST /api/telnyx/inbound` JSON + Telnyx signature verify |
| `POST /api/twilio/message-status` | `POST /api/telnyx/message-status` (or combined messaging webhook) |
| `POST /api/twilio/compliance-status` | Telnyx 10DLC event notifications → `/api/telnyx/compliance` |

Preserve behavior:
- Resolve customer by destination number
- STOP / START / UNSUBSCRIBE / CANCEL / END / QUIT / HELP
- Suppression list updates
- Fast 200 + background work where needed
- Idempotent handling (Telnyx retries)

Keep Twilio webhook routes until Telnyx paths are verified.

---

## 9. Risks / missing information

| Risk | Notes |
|------|-------|
| Telnyx credentials not in repo yet | Need live `TELNYX_API_KEY` + public key for webhook verify |
| Compliance UI still mock | Backend registration API exists; UI may need wiring later (out of scope for provider swap) |
| One-number-per-workspace | Matches Telnyx isolation rules; keep |
| Carrier filtering | Still possible after approval; no delivery guarantee |
| Twexit != 10DLC | Easy to overestimate Twexit’s coverage |
| Webhook payload mismatch | Do not assume Twilio form handlers work for native Telnyx JSON |
| EIN / registration data | Must never submit placeholders |
| Managed accounts | Deferred; single account MVP |

**Missing from environment today:** any Telnyx keys, org id, or webhook public key.

---

## 10. Phased implementation checklist

### Phase 1 — Abstraction
- [x] Audit Twilio usage (this document)
- [x] `MessagingProvider` interface
- [x] Keep `TwilioProvider` wrapping existing adapter
- [x] `TelnyxProvider` + HTTP client
- [x] `.env.example` Telnyx vars
- [x] Additive SQL / Prisma fields for provider-neutral IDs
- [x] Provider selection via `MESSAGING_PROVIDER`

### Phase 2 — Send / receive
- [x] Native Telnyx outbound SMS (`sendViaRegistration` → provider)
- [x] Unified messaging webhook `/api/telnyx/messaging` (inbound + DLR)
- [x] Legacy aliases `/api/telnyx/inbound` + `/api/telnyx/message-status`
- [x] Ed25519 signature verify + timestamp skew check (always via `telnyxProvider`)
- [x] Keyword auto-replies (STOP/START/HELP) sent back via Telnyx
- [x] Preserve STOP/HELP/suppression (shared inbound processor; Twilio uses it too)
- [x] Wiring test: `npx tsx scripts/test-telnyx-wiring.ts`

### Phase 3 — Numbers + 10DLC
- [x] Number search + purchase via provider
- [x] Per-customer messaging profile (`ensureTelnyxWorkspace`)
- [x] Brand create + status polling (`advanceTelnyxRegistration`)
- [x] Campaign create + status polling
- [x] Assign campaign to number
- [x] Block sending until ready gate / `approved`
- [x] Compliance webhook `/api/telnyx/compliance`

### Phase 4 — Cutover
- [x] Set `MESSAGING_PROVIDER=telnyx` + `TELNYX_MODE=live` for new customers
- [ ] Production send/receive verification (requires live Telnyx credentials)
- [ ] Monitor logs / DLRs

### Phase 5 — Cleanup (only after verified in production)
- [ ] Remove active Twilio adapter paths
- [ ] Remove Twilio secrets from env
- [ ] Optionally drop Twilio-only columns later
- [ ] Keep migration audit records

### Ops checklist to go live
1. Run `supabase/telnyx-provider-fields.sql` on Supabase.
2. Set `MESSAGING_PROVIDER=telnyx`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_MODE=live`, `APP_URL`.
3. Point Telnyx webhooks to:
   - Messaging profile (inbound + delivery): `https://<app>/api/telnyx/messaging`
   - Brand/campaign compliance: `https://<app>/api/telnyx/compliance`
   - Legacy aliases still work: `/api/telnyx/inbound`, `/api/telnyx/message-status`
4. Keep Twilio env vars until production verification is complete.

---

## Architecture rules (locked)

1. Transovo is an ISV.
2. Each customer business = separate 10DLC end brand.
3. Each customer gets own messaging profile, dedicated number, brand, campaign.
4. Never share sending numbers across brands.
5. Numbers assigned only to the correct approved campaign.
6. Never send Customer A traffic through Customer B’s profile/campaign/number.
7. Single main Telnyx account for MVP.
8. Live messaging disabled until registration approved + number assigned.
9. No Platform Free Trial messaging.
10. No shared trial phone number.
11. No unregistered US long-code traffic.
12. Preserve consent, STOP, HELP, opt-out, suppression.
