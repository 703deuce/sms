# Integrations UI Merge Matrix

| Integration | Original screen | Newer screen | Preferred UI | Canonical backend | Merged? |
|-------------|-----------------|--------------|--------------|-------------------|---------|
| Microsoft Calendar | — | `/integrations/calendars` | `/integrations` Platform cards | Calendar OAuth API | Yes |
| Google Calendar | — | `/integrations/calendars` | `/integrations` Platform cards | Calendar OAuth API | Yes |
| Stripe Connect | Directory (billing) | `/integrations/payments` | `/integrations` Platform cards | merchant-payments | Yes |
| Square | — | `/integrations/payments` | `/integrations` Platform cards | merchant-payments | Yes |
| Salesforce | ConnectableProvidersGrid | — | Original grid | CRM | Yes (unchanged) |
| Zoho | ConnectableProvidersGrid | — | Original grid | CRM | Yes |
| Calendly | ConnectableProvidersGrid | — | Original grid | Native | Yes |
| WooCommerce | ConnectableProvidersGrid | — | Original grid | Native | Yes |

**UNMERGED_WORKING_INTEGRATIONS = 0**
