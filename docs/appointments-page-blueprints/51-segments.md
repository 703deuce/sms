# Blueprint 51 — Segments (`/contacts/segments`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-5 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 2-40 | General customer segments | Contacts → Segments | `/api/contacts/segments` | ABSORBED_CANONICAL_UI |
| 2-40 | Appointment-derived presets | Recalls / appointment-segments | `appointment-segments.ts` | ALREADY_PRESENT (recall-specific) |
| — | Appointment status conditions | Segment builder | `segment-query.ts` | ABSORBED_CANONICAL_UI |
