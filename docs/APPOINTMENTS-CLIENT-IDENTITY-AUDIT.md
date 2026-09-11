# Appointments Client Identity Audit

See also `APPOINTMENTS-CLIENT-IDENTITY-MATCHING.md`.

- **Canonical model:** `Contact`
- **Client routes:** `/appointments/clients`, `/appointments/clients/[clientId]` where `clientId === contact.id`
- **Public booking:** phone-first match in `createPlatformAppointment` → `resolveOrCreateContact`
- **Admin create:** duplicate check on normalized email/phone
- **Merge:** `POST /api/appointments/clients/merge` wraps `mergeContacts`
- **Block:** `clientBookingRestriction.blockPublicBooking` (not auto-canceling future appointments)
- **Gap:** email-only public booking match not implemented (phone required today)
