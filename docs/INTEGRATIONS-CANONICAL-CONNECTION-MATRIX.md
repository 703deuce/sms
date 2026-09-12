# Integrations Canonical Connection Matrix

| Provider | Canonical backend | Connection model | Connect action | Status source |
|----------|-------------------|------------------|----------------|---------------|
| Microsoft Calendar | `lib/calendar/*`, Graph | `integration_connections` calendars | `/api/integrations/calendars/oauth/microsoft` | `/api/integrations/calendars` |
| Google Calendar | same | same | `/api/integrations/calendars/oauth/google` | same |
| Stripe | `merchant-payments/stripe-connect` | `MerchantPaymentConnection` | `POST /api/merchant-payments/stripe/connect` | `GET /api/merchant-payments/status` |
| Square | `merchant-payments/square` | `MerchantPaymentConnection` | `GET /api/merchant-payments/square/connect` | same |
| Salesforce/Zoho/etc. | CRM/native frameworks | `integration_connections` | existing OAuth start routes | `/api/integrations/connections` |

**DUPLICATE_OAUTH_IMPLEMENTATIONS = 0**
