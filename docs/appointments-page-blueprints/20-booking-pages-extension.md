# Page Blueprint — Booking Pages (Batch 8B-1)

**Route:** `/appointments/booking`  
**Status:** Batch 8B-1 implemented  
**Primary user job:** What does my customer booking experience look like, and how do I share it?

## Sections

| Section | Implementation |
|---------|----------------|
| General | Public booking toggle, business info |
| Branding | `BookingBrandingPanel` — theme, terminology, domain, CSS |
| Share & Embed | `BookingShareEmbedSection` — links, QR, embed, single-use |
| Confirmation | SMS consent / terms |
| Advanced | AI booking protection |

## Gap records (Batch 8A → 8B-1)

| FEATURE ID | AUDIT GAP | FINAL SECTION | BACKEND | UI CONTROL | STATUS |
|------------|-----------|---------------|---------|------------|--------|
| 2-25 | Booking page settings | General | `settings.ts` | Business info, enable toggle | ABSORBED_CANONICAL_UI |
| 2-26 | Share hub split | Share & Embed | share client | Consolidated section | ABSORBED_CANONICAL_UI |
| 2-27 | QR | Share & Embed | QR API | QR preview/download | ABSORBED_CANONICAL_UI |
| 2-29 | Embed iframe | Share & Embed | `booking-links.ts` | Embed code + preview | ABSORBED_CANONICAL_UI |
| 2-31 | Scheduler theme | Branding | `scheduler-theme.ts` | Branding panel | ABSORBED_CANONICAL_UI |
| 2-32 | Custom domain | Branding | theme config | Domain field + status | ABSORBED_CANONICAL_UI |
| 2-33 | Advanced CSS | Branding | theme config | Collapsible CSS editor | ABSORBED_CANONICAL_UI |
| 2-34 | Terminology | Branding | theme config | Label pairs + preview | ABSORBED_CANONICAL_UI |
| 2-35 | Direct links | Share & Embed | public routes | Per-type copy/preview | ABSORBED_CANONICAL_UI |
| 5-3 | Embeddable widget | Share & Embed | embed route | Admin embed (public wave pending theme apply) | ABSORBED_CANONICAL_UI |

## Remaining

- Public runtime theme/terminology/CSS application → PUBLIC_WAVE_PENDING
- Legacy `/appointments/booking/share` and `/branding` routes preserved (not retired)
- Contacts/Inbox audit rows — NOT on this page (IA correction)
