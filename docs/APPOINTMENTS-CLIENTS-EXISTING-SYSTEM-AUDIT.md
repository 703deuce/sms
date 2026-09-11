# Appointments Clients — Existing System Audit

Admin **Client** = appointment-business view of canonical **`Contact`** (`prisma.contact`). No separate Client table.

| Area | Status | Notes |
|------|--------|-------|
| Contact model | WORKING | `Contact` workspace-scoped; phone E.164 via `normalizeE164` |
| Customer model | N/A | No parallel customer entity |
| Appointment linkage | WORKING | `voiceAppointment.contactId` |
| Public booking identity | WORKING | `resolveOrCreateContact` matches **phone** (`booking-platform.ts`) |
| Duplicate detection (admin) | WORKING | `findDuplicateClientCandidates` email + normalized phone |
| Merge | WORKING | `mergeContacts` repoints appointments, packages, memberships, intake forms, POS sessions |
| Merge audit | WORKING | `contactMergeAudit` |
| Client booking block | WORKING | `clientBookingRestriction` + `assertClientNotRestricted` on public book |
| Packages | WORKING | `packageBalance.contactId` |
| Memberships | WORKING | `serviceMembershipSubscription.contactId` |
| Payments | PARTIAL | Client detail uses `appointmentMerchantPayment` by appointment IDs; full invoice ledger not aggregated on Client page |
| Account credit | WORKING | `getWalletBalance` / `clientWalletAccount` |
| Forms | PARTIAL | `intakeFormResponse` listed; pending/due states not fully modeled on Client UI |
| Messages | PARTIAL | Deep-link to `/conversations?contact=`; no embedded thread |
| Notes | WORKING | `contact.customFields.appointmentsClientNotes` |
| Activity | WORKING | `getContactActivityTimeline` |
| Import | WORKING | Link to `/contacts/imports` |
| Portal identity | MISSING | Intentionally deferred to Client Portal pass |
| Contact status BLOCKED | LEGACY | Directory maps `BLOCKED`/`INVALID`; primary block uses restrictions |
| Directory balance N+1 | PARTIAL | Per-row payment summary on next appointment only |

Preserved: all canonical Contact, merge, restriction, wallet, and booking flows. **No schema changes** for Clients pass.
