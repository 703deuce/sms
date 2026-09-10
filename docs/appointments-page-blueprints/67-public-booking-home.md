# Blueprint 67 — Public Booking Home

**Route:** `/book/[slug]`  
**Batch:** 8B-8 — Public Booking Completion  
**Status:** Implemented (static validation)

## Primary job

Answer: *What can I book with this business?*

## Structure

1. Lightweight public header (logo/name, timezone, phone) — no admin nav
2. Grouped offerings:
   - Meetings
   - Services (with optional category sub-groups)
   - Workshops & Events
   - Classes → link to `/book/[slug]/classes`
3. Hide empty groups
4. Custom terminology from `schedulerTheme.terminology`

## Data sources

- `GET /api/public/book/[slug]` → `types`, `catalog`, `terminology`, `categories`
- `buildPublicBookingCatalog()` — visibility `public` only on home
- Direct links: `?typeId=` includes unlisted types

## Prohibited

- Archetype / booking-kind picker
- POS or admin chrome
- Listing secret/unlisted types on home

## Completion gate

- [x] Four customer-facing categories represented
- [x] Visibility respected
- [x] Terminology applied
- [x] Classes deep link
- [ ] Search (only when many offerings — deferred)
