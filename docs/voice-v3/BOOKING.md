# Voice V3 — Booking scene (REVALIDATE → BOOK → CONFIRM)

## Flow

```
FIND → OfferSet → PresentedOffer → SelectedSlot
→ intake complete → BOOKING_READY
→ fresh Microsoft busy revalidation (not stale OfferSet)
→ insertMicrosoftEvent (transactionId = bookingAttemptId)
→ BOOKING_CONFIRMED → Live may say "confirmed"
```

Nothing before `BOOKING_CONFIRMED` may be described as booked.

## Idempotency

- `bookingAttemptId` is allocated before Graph mutation and passed as Microsoft `transactionId`.
- Per-session registry dedupes by `schedulingGeneration|offerSetId|slotId`.
- Duplicate rule evaluation / reconnect must not create a second event when the first attempt already confirmed.

## Uncertain outcomes

Network timeout after `COMMIT_SENT` → `BOOKING_OUTCOME_UNKNOWN` (no blind retry create).

## Post-book change (detection only)

`post_book_intent: CHANGE_CONFIRMED_APPOINTMENT` sets `postBookChangeRequested` while preserving `booking.confirmed`. No reschedule in this milestone.

## Tests

```bash
npm run test:voice-v3-booking
```

Live Graph integration: set `VOICE_V3_TEST_MICROSOFT_CONNECTION_ID` and run operator calendar verify (see milestone checklist).
