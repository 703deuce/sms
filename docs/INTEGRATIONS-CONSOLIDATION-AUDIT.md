# Integrations Consolidation Audit

## Surfaces found

| Surface | Route | Role |
|---------|-------|------|
| **Original (preferred UI)** | `/integrations` | `SectionHeader`, `ConnectableProvidersGrid`, `IntegrationsDirectory` — Salesforce, Zoho, Calendly, WooCommerce, CRM, API, webhooks |
| **Newer (appointments)** | `/integrations/calendars` | Kimi calendar shell + `CalendarIntegrationsCard` — Google/Microsoft OAuth |
| **Newer (appointments)** | `/integrations/payments` | `PaymentsIntegrationsConnected` + `MerchantPaymentsPanel` — Stripe Connect, Square |

## Consolidation decision

- **Visual authority:** `/integrations` (original directory + connectable grid)
- **Canonical backends:** unchanged OAuth/calendar/merchant-payment APIs
- **Legacy sub-routes:** redirect to `/integrations?provider=…`

## Provider summary

| Integration | Old UI | New UI | Backend | OAuth |
|-------------|--------|--------|---------|-------|
| Salesforce | ConnectableProvidersGrid | — | CRM OAuth | Yes |
| Zoho | ConnectableProvidersGrid | — | CRM OAuth | Yes |
| Calendly | ConnectableProvidersGrid | — | Native OAuth | Yes |
| WooCommerce | ConnectableProvidersGrid | — | Native credentials | — |
| Microsoft Calendar | — | Calendars page | `/api/integrations/calendars` | Yes |
| Google Calendar | — | Calendars page | same | Yes |
| Stripe Connect | Directory (billing only) | Payments page | `/api/merchant-payments/stripe/*` | Connect |
| Square | — | Payments page | `/api/merchant-payments/square/*` | OAuth |

**UNACCOUNTED_INTEGRATIONS = 0**
