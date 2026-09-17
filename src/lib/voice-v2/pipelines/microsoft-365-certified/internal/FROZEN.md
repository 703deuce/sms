# Frozen Microsoft 365 booking internals

Snapshot of **`06125f5f`** booking-critical modules. **Do not import** from `src/lib/voice-v2/find-availability`, `offer-set-store`, `calendar/providers`, Calendly, or other strategies.

Entry points `find-availability.ts` / `book-offered-slot.ts` import only from here plus `@/lib/db` and `@/lib/supabase/id`.

**Availability:** Graph busy + `microsoft-local-ledger-busy.ts` (provider-confirmed or valid explicit hold only). Not naive `voiceAppointment` overlap.

Regenerate from baseline only with explicit recert — never refactor shared code into this tree from other providers.
