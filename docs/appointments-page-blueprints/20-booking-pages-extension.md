# Page Blueprint — Booking Pages Extension

**Status:** FINAL — Batch 5  
**Route:** `/appointments/booking`

```
PAGE: Booking Pages
ROUTE: /appointments/booking?section=general|branding|share|confirmation|advanced
CLASSIFICATION: EXTEND — preserve Kimi booking visual design, consolidate share/branding
PRIMARY USER: Business owner
PRIMARY USER JOB: What does my booking page look like and how do I share it?
SOURCE FEATURE ROWS: Public booking, branding/theme, share/embed, confirmation defaults
```

## EXISTING UI TO PRESERVE

`BookingView`, `PublicBookingCard`, `LivePreview`, Kimi booking CSS — do not redesign

## EXISTING COMPONENTS TO REUSE

`BookingConnected`, `BookingShareHubClient`, `ThemeEditor` / branding from commerce, `BookingAdvancedPanel`

## PRIMARY ACTION

Save per section; Preview public page

## SECONDARY ACTIONS

Copy link, QR, embed code, custom domain verify

## LOCAL NAV

Booking → Booking Pages (Share & embed merged as section, not separate nav item)

## PAGE SECTIONS IN ORDER

1. General — enable booking, name, slug, business info, preview  
2. Branding — logo, colors, terminology, custom domain  
3. Share & Embed — links, QR, embed, single-use links  
4. Confirmation — workspace defaults + inheritance note  
5. Advanced — custom CSS quiet section

## TABLE/LIST FIELDS

N/A — settings surface; single-use links table when present

## DRAWERS / MODALS

DNS instructions for custom domain

## EMPTY STATE

N/A — always has workspace defaults

## LOADING / ERROR / SUCCESS

Existing BookingLoading/BookingError; saved toast

## DEPENDENCIES

`/api/appointments/settings`, theme API, types, categories, staff, locations for share hub

## CONTEXTUAL CREATE ACTIONS

N/A

## PUBLIC COUNTERPART

`/book/[slug]` and embed routes

## RESPONSIVE

Existing booking-grid responsive behavior

## ACCESSIBILITY

Section tab keyboard nav; copy buttons with feedback

## BACKEND PRESENT

Booking settings, scheduler theme, share URL builders, single-use links if API exists

## BACKEND GAPS

Custom domain verify may be environment-blocked; confirmation overrides per-type remain on type editors

## BROWSER UAT

B1–B9 per Batch 5 spec

## OLD ROUTES TO MERGE/RETIRE

`/appointments/booking/share` → redirect with `?section=share`  
`/appointments/booking/branding` → redirect with `?section=branding`  
Commerce theme → branding section (transitional commerce remains)
