# Cross-Surface Duplicate / Reuse Matrix

| Capability | Canonical owner | Canonical API / model | MCTB-specific duplicate? | Other surfaces | Status |
|------------|-----------------|----------------------|---------------------------|----------------|--------|
| Missed-call recovery | MCTB runtime | `MissedCallEvent`, TeXML, `MissedCallTextConfig` | No | — | **CANONICAL** |
| SMS conversation | Inbox | `Conversation`, `/api/sms/*` | No | MCTB, Appointments inbox | **CANONICAL** |
| Book appointment | Booking | `/api/appointments`, calendar APIs | No (MCTB routes are wrappers) | Conversation actions | **CANONICAL** |
| Send booking link | Booking + contacts | `/api/contacts/actions` `send_booking_link` | No | Conversation | **CANONICAL** |
| Text-to-Pay | Payments | `PaymentRequest`, `/api/payment-requests` | No | `/payments`, Conversation | **CANONICAL** |
| Appointment checkout | Booking payments | `AppointmentMerchantPayment` | No | Public booking | **CANONICAL** (sibling ledger) |
| Stripe Connect | Integrations / merchant | `MerchantPaymentConnection` | No | Integrations UI, Payments | **CANONICAL** |
| Microsoft calendar | Integrations | `/api/integrations/calendars` | No | Booking availability | **CANONICAL** |
| CRM OAuth | Integrations | `integrationConnection` | No | `/integrations/native` | **CANONICAL** |
| MCTB configuration | Setup + onboarding | `/api/mctb/setup`, `mctbOnboarding` JSON | No | Wizard | **SHARED STATE** |
| TFV / trial number | Onboarding + drawers | `/api/mctb/onboarding`, `/api/mctb/numbers` | No | Setup phone | **CANONICAL** |
| Voicemail inbox | MCTB operational | `/mctb/voicemail`, `/api/phone/voicemail` | No | Setup greeting only | **SPLIT OK** |
| MCTB analytics | MCTB | `/api/mctb/analytics` | No | — | **CANONICAL** |
| Legacy `/voice/*` MCTB | Redirect/shell paths | Same backends | Partial routes | Shell | **LEGACY ALIAS** |
| Platform Stripe billing | Settings/billing | `workspace.stripeCustomerId` | N/A | Integrations directory card | **SEPARATE PRODUCT** |
| Legacy `PaymentLink` | SMS marketing | `PaymentLink` model | No | Old SMS flows | **LEGACY — not Text-to-Pay** |

**UNMERGED_WORKING_INTEGRATIONS:** 0 (per integrations consolidation ledger)  
**DUPLICATE_OAUTH_IMPLEMENTATIONS:** 0  
**DUPLICATE_PAYMENT_REQUEST_ENGINES:** 0  
