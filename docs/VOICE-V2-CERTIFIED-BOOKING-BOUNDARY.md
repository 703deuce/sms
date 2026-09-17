# Voice V2 certified booking boundary

**Baseline:** `06125f5f` · `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

## Sealed pipeline

```
caller wants booking → FIND → canonical offer set → caller selects canonical slot → BOOK → Graph 201 → spoken confirmation
```

## Invariants

1. **FIND** does not require CallContext, qualification, recovery, or analytics subsystems.
2. **FIND** always persists the canonical `voiceV2OfferSet`.
3. After slots are offered, **BOOK** is the only path to a booked outcome; the LLM must not claim booked without `BOOKING_CONFIRMED`.
4. **BOOK** accepts only persisted `offer_set_id` + `selected_slot_id` (optional server-side label resolution within that offer set).
5. **BOOK** revalidates Microsoft busy + reconciled local ledger, then creates the provider event.
6. **Provider success** is required before Amy may confirm booked.
7. Recovery, analytics, summaries, workflow patches, and post-call jobs are **downstream observers** — failures there do not block FIND/BOOK.
8. If BOOK succeeds and bookkeeping fails, the appointment remains successful.

## Implementation

- Telnyx routes `/api/telnyx/voice-v2/find-availability` and `book-offered-slot` pass `certifiedPipeline: true`.
- `certified-booking-pipeline.ts` defines the handoff payload merged into FIND tool responses.
- Feature gates (`authorize-find-book`, `qualification-gate`, `evaluateBookingIntakeGate`) are skipped on the certified hot path only.

## Recertification

Any change to frozen paths in `baseline-lock.ts` or to certified gating/handoff requires PSTN re-run per `KNOWN_GOOD_BASELINE.md`.
