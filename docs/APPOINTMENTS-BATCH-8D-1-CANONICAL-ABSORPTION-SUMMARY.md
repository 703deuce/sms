# Appointments Batch 8D-1 — Canonical Absorption Summary

**Generated:** 2026-09-10  
**Batch type:** Implementation (NOT route retirement)

## Completion gate

| Metric | Before (8C) | After (8D-1) |
|--------|------------:|-------------:|
| V1_WRONG_PLACEMENT | 16 | **0** |
| Temp routes with unique V1 | 11 | **0** |
| Commerce unique V1 (temp hub estimate) | 11 | **0** |
| READY_FOR_ROUTE_CONVERGENCE | NO | **YES** |
| Residual implementation rows | 161 | **145** |

Temp routes were **preserved** (no redirects, deletes, or retirements).

---

## Wrong placement (16 rows → 0)

| ID | Feature | Was wrong on | Canonical destination | Status |
|----|---------|--------------|----------------------|--------|
| 3-6 | Blackout dates (category context) | `/appointments/categories` | `/appointments/types` → Manage categories drawer | V1_COMPLETE |
| 3-12 | Minimize gaps (contract context) | `/appointments/contracts` | `/appointments/booking/forms` | V1_COMPLETE |
| 3-15 | Group scheduling (resources) | `/appointments/resources` | `/appointments/booking/rooms-equipment` | V1_COMPLETE |
| 3-16 | Resource-constrained slots (classes) | `/appointments/classes` | `/appointments/types/classes` | V1_COMPLETE |
| 4-8 | Resources (rooms, equipment) | `/appointments/resources` | `/appointments/booking/rooms-equipment` | V1_COMPLETE |
| 5-21 | Group attendee count (share) | `/appointments/booking/share` | `/appointments/booking` hub + share sub-route | V1_COMPLETE |
| 5-22 | Email OTP (branding context) | `/appointments/booking/branding` | `/appointments/booking` hub + branding sub-route | V1_COMPLETE |
| 6-3 | Calendar slot-click (recall) | `/appointments/recall-campaigns` | `/appointments/automations/recall` | V1_COMPLETE |
| 6-4 | Appointment detail (no-show) | `/appointments/no-show-recovery` | `/appointments/automations/no-show` | V1_COMPLETE |
| 6-8 | Cancel staff (segments) | `/appointments/segments` | `/contacts/segments` + `/appointments/recalls` | V1_COMPLETE |
| 8-2 | Package products | commerce hub | `/appointments/packages` | V1_COMPLETE |
| 8-8 | Membership products | commerce hub | `/appointments/memberships` | V1_COMPLETE |
| 8-15 | Gift certificates | commerce hub | `/appointments/gift-cards` | V1_COMPLETE |
| 10-10 | Recall campaigns | `/appointments/recall-campaigns` | `/appointments/automations/recall` | V1_COMPLETE |
| 10-12 | No-show recovery | `/appointments/no-show-recovery` | `/appointments/automations/no-show` | V1_COMPLETE |
| 11-8 | Voice reminders | `/appointments/voice-reminders` | `/appointments/reminders` voice channel | V1_COMPLETE |

---

## Temp routes (11 → NO_UNIQUE_V1_REMAINING)

| Temp route | Unique before | Canonical home | UI | Backend |
|------------|--------------:|----------------|----|---------|
| `/appointments/contracts` | 1 | `/appointments/booking/forms` | ContractsAdminClient | `booking-contracts.ts` |
| `/appointments/categories` | 1 | `/appointments/types` drawer | CategoryManagerDrawer | `booking-category.ts` |
| `/appointments/segments` | 1 | `/contacts/segments` + Recalls saved views | Presets panel + migration page | `appointment-segments.ts` |
| `/appointments/recall-campaigns` | 1 | `/appointments/automations/recall` | RecallCampaignsClient | `recall-campaigns.ts` |
| `/appointments/no-show-recovery` | 1 | `/appointments/automations/no-show` | NoShowRecoveryClient | `no-show-recovery.ts` |
| `/appointments/commerce/contact-merge` | 1 | Contacts → Merge duplicate | ContactMergeDialog | `contact-merge.ts` |
| `/appointments/booking/share` | 1 | Booking hub Share & embed | BookingShareHubClient + layout nav | direct-link / QR APIs |
| `/appointments/booking/branding` | 1 | Booking hub Branding | ServiceBookingAdminClient theme | `scheduler-theme.ts` |
| `/appointments/classes` | 1 | `/appointments/types/classes` | ServiceBookingAdminClient classes | class platform backend |
| `/appointments/resources` | 1 | `/appointments/booking/rooms-equipment` | ServiceBookingAdminClient resources | `resources.ts` |
| `/appointments/voice-reminders` | 1 | `/appointments/reminders` voice channel | RemindersWithVoiceClient | `appointment-voice-reminders/` |

---

## Group summaries

### Contracts
- Canonical: `/appointments/booking/forms` with full `ContractsAdminClient` (create, edit, assign, signature requirement, preview).
- Remaining gap: contextual contract picker from every type editor section (partial — links to forms hub).

### Categories
- Canonical: Manage categories drawer on Booking Types + service editor Category field.
- Remaining gap: none for list CRUD; service count display depends on API enrichment.

### Segments
- General → `/contacts/segments` with appointment-derived presets panel.
- Recall → Recalls hub saved views panel.
- Temp `/appointments/segments` shows migration pointers only.

### Recall / No-show automation
- Canonical routes under `/appointments/automations/recall` and `/automations/no-show`.
- Recalls hub links updated; temp routes preserved.

### Contact merge
- Canonical: Contacts row menu → Merge duplicate modal (6-step flow with conflict resolution).
- Temp commerce page preserved.

### Booking share / branding
- Booking layout subnav connects Pages, Share, Branding, Forms, Rooms & equipment.
- Share and branding sub-routes unchanged but now part of canonical hub.

### Classes / Rooms & equipment
- Canonical list/editor surfaces created; type editor links updated.

### Voice reminders
- **Scope decision:** V1 legitimate (master inventory row 11-8, appointment reminder channel).
- Absorbed as voice channel section on `/appointments/reminders` (not standalone telephony product).

### Commerce unique V1
- Packages, memberships, gift certificates → dedicated canonical routes.
- Commerce hub nav entries updated; hub route preserved.

---

## Artifacts updated

- `docs/APPOINTMENTS-POST-ABSORPTION-LEDGER.csv` (regenerated)
- `docs/APPOINTMENTS-RESIDUAL-V1-IMPLEMENTATION-QUEUE.md` (regenerated)
- `docs/APPOINTMENTS-TEMP-ROUTE-UNIQUE-FEATURE-AUDIT.md` (regenerated)
- `docs/APPOINTMENTS-V1-CLOSURE-SUMMARY.json` (regenerated)
- `scripts/reconcile-appointments-batch8c.mjs` (8D-1 evidence + TEMP route classifications)

## Static validation

- `npx tsc --noEmit` — no new errors in `src/` (pre-existing `.next/types` noise only)

## Explicitly NOT done (per batch scope)

- Route retirement / redirects / deletes
- Master browser UAT or product certification
- Public (8D-2), portal (8D-3), or operations (8D-4) residual batches

## Next

1. **8D-2** — 35 public booking UI gaps  
2. **8D-3** — Portal residual  
3. **8D-4** — Operations residual  
4. Re-run 8C reconciliation after each batch  
5. Route convergence only when `TEMP ROUTES WITH UNIQUE V1 = 0` globally (now YES for batch 11 list)
