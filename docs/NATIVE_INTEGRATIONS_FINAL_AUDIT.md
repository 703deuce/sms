# Native Integrations Final Completion Audit

## Classification legend

- **Fully live-wired in code** — UI → API → auth → queue → worker → adapter → mapping → product surface → diagnostics → test
- **Code implemented but not live tested** — wired; needs customer credentials
- **Intentionally unsupported** — typed + UI gated + documented

## Shared framework

| Area | Status |
|------|--------|
| OAuth + credential auth | Fully live-wired in code |
| Callback builder (`getIntegrationAppUrl`) | Fully live-wired in code |
| Env health `/api/integrations/native/env` | Fully live-wired in code |
| Action registry + `integration_action` job | Fully live-wired in code |
| Automation bridge (no longer no-op) | Fully live-wired in code |
| Product persist (appointments + form submissions) | Fully live-wired in code |
| Contact links API + panel | Fully live-wired in code |
| Messenger + phone context | Fully live-wired in code |
| Segment `source` / `provider` | Fully live-wired in code |
| Lead inbox + Appointments pages | Fully live-wired in code |
| Global search (appointments/forms/external IDs) | Fully live-wired in code |
| Workers `ext-*` + in-process drain | Fully live-wired in code |
| New Prisma migrations | Intentionally unsupported — reuses CRM/integration tables |

## Product surfaces

| Surface | Status |
|---------|--------|
| Automations triggers (20 integration_*) | Fully live-wired in code |
| Automations action `integration_action` | Fully live-wired in code |
| Contacts → Connected apps | Fully live-wired in code |
| Messenger sidebar | Fully live-wired in code |
| Phone screen-pop | Fully live-wired in code |
| Campaign segments provider/source | Fully live-wired in code |
| Forms lead inbox | Fully live-wired in code |
| Appointments area | Fully live-wired in code |
| Freshdesk ticket actions via automations | Fully live-wired in code |
| Unified tasks page (Close/HL + Zoho) | Partial — actions via automations/adapters; dedicated unified tasks UI not expanded this pass |
| Analytics attribution | Partial — event envelope + provider dimensions stored; report UI later |
| Orders dedicated UI | Partial — search + automations + contact context; lightweight list not added |

## Per-provider (auth → product)

All ten: **Fully live-wired in code** for connect/validate/sync/events/diagnostics/acceptance paths.  
Live acceptance: **Code implemented but not live tested** until credentials.

Webhook registration:

| Provider | Mode |
|----------|------|
| Calendly | Automatic when plan/role allows; else reconcile |
| Typeform / Jotform / WooCommerce | Automatic registration supported |
| Mailchimp / AC / Close / Freshdesk / Klaviyo / HighLevel | Normalize inbound + polling/incremental; auto-register where method exists |

## Intentionally unsupported

- Auto-SMS from adapters
- Zendesk / marketplace apps
- HighLevel multi-account OAuth
- WooCommerce payment/refund/inventory mutations
- Inferring SMS consent from phone (Klaviyo)
- Close Lead → Transovo generic lead 1:1

## Automated tests

`npm run test:native-integrations` → **17 passed** (auth, encryption, jobs, callbacks, env redaction, automation catalog, actions, segments, unsupported typing).

## Remaining live-only steps

Credentials + OAuth app registration per `docs/integrations/*_SETUP.md` and `OPERATOR_CHECKLIST.md`.
