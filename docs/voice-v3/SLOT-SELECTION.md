# Voice V3 — Authoritative slot selection (no BOOK)

## Flow

```
Microsoft FIND → AvailabilityOfferSet
→ GPT-Live presents subset (PresentedOffer)
→ caller responds naturally
→ Astra slot_selection meaning (semantic only)
→ resolveSlotSelection() against current OfferSet + presentation
→ SelectedAvailabilitySlot in CallContext
→ session.thinking.append (selected, NOT booked)
```

Astra interprets **what the caller meant**. The runtime decides whether that maps to a slot in the **current** offer set. No Microsoft calendar mutation.

## Semantic meaning (`slot_selection`)

| Field | Role |
|-------|------|
| `selection_type` | `EXACT_TIME`, `ORDINAL`, `EARLIEST`, `LATEST`, `ACCEPT_SINGLE_OFFER`, `NONE` |
| `spoken_time` | Local time phrase (e.g. `14:30`, `2:30`, `four`) — not `slotId` |
| `ordinal` | 1-based index against **presented** slots |

Astra must **not** return `slotId`, `offerSetId`, or booking confirmation flags in normal flow.

## Resolver outcomes

`resolveSlotSelection()` → `RESOLVED` | `AMBIGUOUS` | `NOT_IN_OFFER_SET` | `NO_CURRENT_OFFER_SET`

- Exact times must match an offered slot start (no fuzzy nearest-neighbor).
- Ordinals use `PresentedOffer.presentedSlotIds`, not the full hidden offer set.
- Scheduling generation change clears selection, offer set, and presentation; new FIND required.

## V3 files

| Path | Role |
|------|------|
| `src/lib/voice-v3/intake/slot-selection-schema.ts` | Zod + `SlotSelectionMeaning` |
| `src/lib/voice-v3/calendar/resolve-slot-selection.ts` | Deterministic resolver |
| `src/lib/voice-v3/calendar/selected-slot.ts` | `SelectedAvailabilitySlot`, `PresentedOffer` |
| `src/lib/voice-v3/calendar/apply-slot-selection.ts` | Apply meaning + invalidate on scheduling change |
| `src/lib/voice-v3/calendar/presentation.ts` | Record presented slot ids |
| `src/lib/voice-v3/calendar/live-selected-slot-context.ts` | Live thinking: selected ≠ booked |

## Rules

When `selection.selected` is authoritative for the current generation, `evaluateVoiceV3Rules()` sets `bookingPhase: SLOT_SELECTED` and does not re-dispatch FIND until scheduling changes.

## Logs

`SLOT_SELECTION_MEANING_RECEIVED`, `SLOT_SELECTION_RESOLVED`, `SLOT_SELECTION_AMBIGUOUS`, `SLOT_SELECTION_NOT_IN_OFFER_SET`, `SLOT_SELECTION_CHANGED`, `SLOT_SELECTION_INVALIDATED`, `PRESENTED_OFFER_RECORDED`, `LIVE_SELECTED_SLOT_CONTEXT_SENT`

## Tests

```bash
npm run test:voice-v3-slot-selection
```

Includes deterministic resolver coverage and optional Astra integration (`OPENAI_API_KEY`).

## PSTN smoke (operator)

After FIND presents times, caller picks a slot → verify `SLOT_SELECTION_RESOLVED` and `LIVE_SELECTED_SLOT_CONTEXT_SENT`; Amy must **not** say booked/confirmed. Changing to another offered slot updates selection without a new FIND. Changing the day invalidates selection and triggers FIND again.
