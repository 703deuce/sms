# Voice V2 certified booking boundary

**Superseded orchestration notes:** Microsoft PSTN no longer uses `certifiedPipeline: true` on shared executors. See **isolation rule** and **Microsoft certified pipeline** docs.

**Authority:** `docs/VOICE-V2-CERTIFIED-PIPELINE-ISOLATION-RULE.md`  
**Baseline:** `06125f5f` · `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`  
**Microsoft sealed module:** `src/lib/voice-v2/pipelines/microsoft-365-certified/`

## Sealed pipeline (Microsoft 365)

```
caller wants booking → FIND → canonical offer set → caller selects canonical slot → BOOK → Graph 201 → spoken confirmation
```

## Invariants

1. **FIND** does not require CallContext, qualification, recovery, or analytics on the **Microsoft Telnyx route**.
2. **FIND** persists the canonical offer set (inside the Microsoft box).
3. After slots are offered, **BOOK** is the only path to a booked outcome; the LLM must not claim booked without `BOOKING_CONFIRMED`.
4. **BOOK** accepts only persisted `offer_set_id` + `selected_slot_id`.
5. **BOOK** revalidates and creates the Microsoft provider event per the **frozen** implementation.
6. **Provider success** is required before Amy may confirm booked.
7. Recovery, analytics, summaries, workflow patches, and post-call jobs are **downstream observers** — not on the Microsoft FIND/BOOK hot path.
8. If BOOK succeeds and bookkeeping fails, the appointment remains successful.

## Implementation (current)

- **Selector:** Wizard `bookingStrategy` + `ensureVoiceV2SharedToolsForAgent` URL choice.
- **Microsoft entry:** `POST /api/telnyx/voice-v2/find-availability` and `book-offered-slot` → `executeMicrosoft365Certified*` only.
- **Calendly entry:** `POST /api/telnyx/voice-v2/calendly/*` → extended executors (separate box; not Microsoft).

## Recertification

Any change under `pipelines/microsoft-365-certified/` or Microsoft Telnyx FIND/BOOK routes requires PSTN re-run per `KNOWN_GOOD_BASELINE.md`.
