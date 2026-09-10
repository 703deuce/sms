# Page Blueprint — Booking Pages (Batch 8B-1)

**Route:** `/appointments/booking`  
**Classification:** KEEP VISUAL + ABSORB PARITY + EXTEND  
**Primary user job:** Control what customers see when they book and distribute booking links.

## Local sections

1. **General** — page enabled, URL, business info (preserved)
2. **Branding** — `BookingBrandingPanel` (logo, primary color, terminology table, custom domain states)
3. **Share & embed** — `BookingShareEmbedSection` (main link, direct links by type, QR modal, embed, single-use links)
4. **Confirmation** — SMS consent / confirmation defaults (preserved)
5. **Advanced** — `BookingAdvancedCssPanel` + AI protection (preserved)

## Absorbed from parity routes

| Source | Destination |
|--------|-------------|
| `/appointments/booking/branding` | Branding section |
| `/appointments/booking/share` | Share & embed section |
| `/appointments/commerce` theme | Branding |

## Backend map

- Theme: `scheduler-theme.ts`
- Terminology: `bookingTerminology`
- Custom domain/CSS: `SchedulerThemeConfig`
- Direct links: `directLinksForWorkspace()` pattern via `/book/{slug}/{typeId}`
- Single-use: `booking-links.ts` + DELETE revoke
- QR: `/api/appointments/booking/qr`
- Embed: `embedBookingUrl`, iframe snippet

## Status

ABSORBED_CANONICAL_UI. PUBLIC_WAVE_PENDING: live public theme/terminology runtime verification. STILL_MISSING: full DNS verification state machine if provider API not wired.
