# Blueprint 65 — Meeting Polls (`/appointments/polls`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-7 ABSORPTION GAPS

| Feature ID | Feature | Status |
|---|---|---|
| 15-7 | Meeting polls admin | ABSORBED_CANONICAL_UI |

## LEDGER PLACEMENT CORRECTION

- Final page: `/appointments/polls` (was incorrectly mapped to `/video`)

## CHANGES

- Create flow uses real API (removed mock delay/fabricated share URL)
- UI adapter maps backend `open|closed|booked` ↔ UI statuses
- Share URL pattern: `/poll/{id}` (public vote page PUBLIC_WAVE_PENDING)

## REMAINING GAPS

- Public participant vote UI (`PUBLIC_WAVE_PENDING`)
- Schedule winning time → create real appointment (`BACKEND_GAP`)
- Email invitations (`BACKEND_GAP`)
