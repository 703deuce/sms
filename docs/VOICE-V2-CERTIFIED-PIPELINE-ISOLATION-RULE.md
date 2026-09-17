# Voice V2 — Certified pipeline isolation rule (standing)

**Status:** Mandatory for all Voice V2 booking work.  
**Optimization target:** Reliability of live customer booking. **Not** line count or DRY.

## Governing sentence

Each **booking strategy** is a **self-contained vertical slice**. Amy exposes one UI and one conversational persona; internally, **Microsoft 365, Calendly, Book-by-Tech, and every future booking mode are separate products**.

## CERTIFIED PIPELINE ISOLATION RULE

1. **Never** refactor a working provider pipeline to support another provider or feature.
2. **Never** extract shared code from a certified provider pipeline.
3. **Never** import another provider’s booking code.
4. **Never** add a generic abstraction underneath multiple booking providers.
5. If a new provider needs behavior already present in a certified provider, **COPY** the implementation into the new provider’s directory and evolve that copy **independently**.
6. New functionality integrates **before** entry into a provider pipeline or **after** its **terminal result**. It **must not** alter the internals of another provider’s certified path.
7. Once Microsoft 365 is working and certified, **stop improving it** unless recertifying intentionally. A Calendly PR should not need Microsoft files in its diff.

## Share nothing inside booking (target architecture)

**Not** “share utilities, isolate orchestration.”

**Share nothing between booking pipelines** unless it lives **outside the booking system entirely** (auth, workspace, billing, generic Telnyx HTTP plumbing, non-booking Amy tools).

If Microsoft needs a timezone serializer, it owns:

`pipelines/microsoft-365-certified/microsoft/timezone.ts` (or equivalent under that tree).

If Calendly needs the same logic, **copy** into `pipelines/calendly/calendly/timezone.ts`.  
If Book-by-Tech needs it, **copy again**. Three copies. Fix each provider **intentionally** when a bug is found.

**Forbidden inside or between provider slices:**

- Shared booking helpers used by more than one strategy
- Shared booking state machine
- Generic provider dispatcher inside a booking pipeline
- Common offer engine, availability engine, or booking engine
- Shared provider-specific date/time code
- Imports from sibling `pipelines/*` directories

**Deliberate duplication is preferred over coupling.**

## The only allowed coupling: dumb selector

Above the sealed boxes, only a **selector** with **no booking logic**:

```
bookingStrategy === MICROSOFT_365 → invoke Microsoft entry point
bookingStrategy === CALENDLY      → invoke Calendly entry point
…
```

The selector does **not** normalize offers, interpret slot selections, revalidate slots, or map provider results. It only routes: *this customer selected Microsoft; enter Microsoft.*

Then **Microsoft owns the entire execution** until a terminal result:

Microsoft input → Microsoft intake requirements (if any, inside the box) → Microsoft date handling → Microsoft FIND → Microsoft offer storage → Microsoft selection → Microsoft revalidation → Microsoft BOOK → Microsoft provider confirmation → Microsoft result.

**Calendly** is another sealed box end-to-end. **Book-by-Tech** is another. If Calendly needs ~90% of Microsoft’s implementation, **clone** the known-good Microsoft tree and replace the provider-specific ~10%. Do **not** refactor the common 90% into a shared library.

### Current selector surfaces (implementation)

| Layer | Role |
|-------|------|
| Wizard publish | `bookingStrategy` on agent advanced config |
| Telnyx tool URLs | `ensureVoiceV2SharedToolsForAgent` — M365 vs Calendly webhook paths |
| HTTP entry | Thin routes that call **one** provider entry function only |

See `docs/VOICE-V2-MICROSOFT-365-CERTIFIED-PIPELINE.md` for Microsoft URLs and verification.

## Observers — outside the box

These **may consume terminal results** (e.g. `BOOKING_CONFIRMED`). They **must not** be inserted into a provider’s internal path:

- AI Call Recovery
- Post-call reconciliation
- Analytics
- After-hours (may **gate whether booking is permitted** at entry — not rewrite FIND/BOOK internals)
- Conversation state (“Amy is booking”) — not substitute for BOOK

## Microsoft 365 certified box (frozen)

- Baseline: commit **`06125f5f`** · `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`
- Sealed copy: `src/lib/voice-v2/pipelines/microsoft-365-certified/`
- Verify: `npx tsx scripts/verify-microsoft-365-certified-pipeline-frozen.ts`
- Allowed without recert: voice provider / model / ElevenLabs on the assistant (presentation only)

## Migration honesty (repo today)

The **PSTN Microsoft path** is isolated at **webhook → certified module**. Full vertical-slice duplication (per-provider `timezone.ts`, offer store, etc.) is the **target**; legacy shared files under `src/lib/voice-v2/find-availability.ts` and friends remain for **non-Microsoft** and historical paths and should **not** receive new coupling to Microsoft. New work **copies forward**, it does not **extract backward**.

## Recertification

Any change under `pipelines/microsoft-365-certified/` or Microsoft Telnyx FIND/BOOK routes requires PSTN re-run per `KNOWN_GOOD_BASELINE.md`.
