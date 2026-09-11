# Meeting poll best-time scoring

Ranking is **transparent** (not AI). For each active (non-archived) time option:

1. **Highest** count of `yes` votes
2. **Lowest** count of `no` votes (tie-breaker)
3. **Highest** count of `maybe` votes
4. **Earliest** `startsAt` ISO timestamp (deterministic tie-breaker)

Displayed **score** (admin tables only): `yes * 1000 - no * 100 + maybe` for sortable numeric column; ranking uses the rules above, not the score alone.

Removed participants do not contribute. Archived options are excluded.

Implementation: `src/lib/appointments/meeting-polls/scoring.ts`.
