# Voice V3 — Reschedule & cancel

Reuses FIND → OfferSet → SelectedSlot → revalidate for **RESCHEDULE**. Uses durable Transovo booking records (`registerDurableBooking`) before Microsoft search. **CANCEL** requires explicit `cancellation_confirmation: CONFIRM` bound to `providerEventId`.

Microsoft: PATCH update (same `providerEventId`) for reschedule; DELETE for cancel. See `microsoft-update-booking.ts`, `microsoft-cancel-booking.ts`.

Tests: `npm run test:voice-v3-reschedule`, `npm run test:voice-v3-cancellation`.
