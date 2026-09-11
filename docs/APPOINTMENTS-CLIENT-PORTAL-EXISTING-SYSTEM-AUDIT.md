# Client Portal — Existing System Audit

| Area | Status | Notes |
|------|--------|-------|
| Contact / Client identity | WORKING | Same `Contact` as Admin Clients |
| `clientPortalSession` | WORKING | Hashed token, 30-day expiry |
| Email OTP login | WORKING | `sendBookingEmailOtp` / `verifyBookingEmailOtp` |
| Legacy `/portal/{token}` | WORKING | Exchanges to httpOnly cookie → `/client` |
| Manage appointment tokens | WORKING | `/manage/{token}` + `manageAppointmentReschedule/Cancel` |
| Public manage API | WORKING | `/api/public/manage/[token]` |
| Portal workspace (new) | WORKING | `/api/client/portal/auth/session` |
| Cookie session (new) | WORKING | `tv_client_portal` httpOnly |
| Reschedule w/ availability | PARTIAL | Portal uses manage flow link; datetime reschedule without full slot picker |
| Cancellation | WORKING | Canonical `manageAppointmentCancel` via authorized API |
| Payments | WORKING | `createManageAppointmentPaymentCheckout` |
| Packages / memberships | WORKING | `listEligibleEntitlementsForContact` |
| Forms | PARTIAL | Completed intake listed; pending completion via manage intake |
| Invoices | MISSING | Not on portal UI |
| Saved payment methods | PARTIAL | Legacy portal payment-methods API (token URL) |
| Password login | N/A | OTP/magic code only |
| Admin user auth | N/A | Separate staff session |
| Portal POST create (old) | FIXED | Unauthenticated session mint removed |

No new customer tables. Schema unchanged this pass.
