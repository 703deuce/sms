# Native Integrations Coverage Audit

Trace standard: Customer connection → auth → account validation → settings → event/sync → queue → worker → adapter → provider API → mapping → DB → diagnostics → tests.

Classification keys:

- **Live-wired and tested** — UI + API + job + worker + adapter + mapping + diagnostics + automated tests
- **Code implemented but not live tested** — wired end-to-end; needs customer/provider credentials in prod
- **Adapter-only / UI-only / DB-only** — must be fixed (none intentionally left)
- **Intentionally unsupported** — documented product choice
- **Blocked by provider plan/permissions** — runtime feature-detect

## Shared framework

| Capability | Status |
|------------|--------|
| OAuth connect/callback/refresh/disconnect | Live-wired and tested (contract) |
| Credential connect/validate/rotate/disconnect | Live-wired and tested (contract) |
| Secret encryption | Live-wired and tested |
| Preferences / pause / read-write gates | Live-wired |
| Object mappings (reuse `crm_object_mappings`) | Live-wired |
| Sync jobs `integration_sync` | Live-wired + consumer registered |
| Webhook jobs `integration_webhook_process` | Live-wired + consumer registered |
| Normalized event publish + idempotency | Live-wired and tested |
| Automation event queue stub | Live-wired (no-op consumer until builder) |
| Diagnostics snapshot + probes | Live-wired |
| Acceptance runner | Live-wired |
| Provider-isolated queues | Live-wired and tested |
| Shared Integrations UI | Live-wired |
| Zoho/Pipedrive redesign | Intentionally unsupported (unchanged CRM framework) |

## Per-provider matrix

| Provider | Auth | Connect UI | Sync | Webhooks | Writes | Diagnostics | Acceptance | Live status |
|----------|------|------------|------|----------|--------|-------------|------------|-------------|
| Calendly | OAuth | Yes | Appointments/invitees | Normalize + register (plan-dependent) | Read probes | Yes | Yes | Code implemented but not live tested |
| ActiveCampaign | Credentials | Yes | Contacts/lists/deals/tags | Normalize | Contact/deal/tag/list/note | Yes | Yes | Code implemented but not live tested |
| Mailchimp | OAuth | Yes | Audiences/members | Normalize | Member upsert/tags (consent-safe) | Yes | Yes | Code implemented but not live tested |
| HighLevel PIT | Credentials | Yes | Contacts/opps/appointments | Normalize | Contact/tag/deal/task/note | Yes | Yes | Code implemented but not live tested |
| WooCommerce | Credentials | Yes | Customers/orders | Register + normalize | Customer/order note only | Yes | Yes | Code implemented but not live tested |
| Typeform | OAuth | Yes | Forms/responses | Register + normalize | Read-only | Yes | Yes | Code implemented but not live tested |
| Jotform | Credentials | Yes | Forms/submissions | Register + normalize | Read-only | Yes | Yes | Code implemented but not live tested |
| Close | Credentials | Yes | Leads→contacts/opps | Normalize | Contact/deal/task/note | Yes | Yes | Code implemented but not live tested |
| Freshdesk | Credentials | Yes | Contacts/tickets | Normalize | Contact/ticket/comment | Yes | Yes | Code implemented but not live tested |
| Klaviyo | Credentials | Yes | Profiles/lists | Normalize | Profile/list (consent-aware) | Yes | Yes | Code implemented but not live tested |

## Intentionally unsupported

- Auto SMS from adapters
- Zendesk (global OAuth / terms)
- Salesforce / Bigin / HubSpot in this batch
- HighLevel multi-account OAuth
- WooCommerce payment/refund/inventory mutations
- Inferring Klaviyo SMS consent from phone presence
- Mapping Close Lead directly to Transovo generic lead

## Remaining live acceptance steps

For each provider with real credentials in a workspace:

1. Connect via `/integrations/native/{provider}`
2. Run **Test connection**, **Read probe**, **Write probe**
3. Run **Run acceptance**
4. Confirm queues drain (`failed=0`)
5. Disconnect and verify credentials cleared

Automated contract suite: `npm run test:native-integrations` (9 passed).
