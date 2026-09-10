# Appointments Business Texting — V1 Scope

**Status:** Approved scope expansion (pre-final certification)  
**Effective:** 2026-09-10  
**Product:** Transovo Appointments — lightweight Business Texting layer

## Governing decision

Appointments V1 now includes **Business Texting**: selective absorption of mature SMS messaging capabilities into the Appointments product. This is **not** a return to the standalone Mass SMS product.

**Pause:** Final master browser certification and final visual polish remain **paused** until Business Texting absorption is complete and reconciled.

## Architectural rules (locked)

| Rule | Canonical home |
|------|----------------|
| One contact database | Contacts → Contacts, Segments, Import, Fields (`/contacts/*`) |
| One inbox | Messages → Inbox (`/conversations`) |
| Campaigns | Messages → Campaigns (`/appointments/campaigns`) |
| Business Texting setup | Settings → Messaging (`/settings/messaging`) |
| Reuse SMS backend | `src/lib/mass-texting/`, `src/lib/messaging/`, `src/lib/campaigns/` |

**Do not create:** SMS Contacts, Business Texting Inbox, Campaign Inbox, standalone Phone Numbers nav, standalone Compliance nav, duplicate template systems.

## V1 Business Texting capabilities

1. Existing Inbox (shared)
2. Existing Contacts (shared canonical database)
3. Contact import (Contacts → Import)
4. Segments / audiences (Contacts → Segments; consumed by Campaigns)
5. Campaigns (list, create, schedule, results)
6. Campaign scheduling (send now / schedule later)
7. Template selection (reuse Automations → Templates when architecture supports)
8. Basic campaign analytics (campaign detail / results — not standalone Reports)
9. Registered business sender / messaging activation (Settings → Messaging)
10. Opt-out / suppression enforcement (existing messaging runtime)

## Feature inventory (expansion IDs)

These rows are **new** — not part of the closed 308-row master inventory.

| ID | Feature | Canonical route / surface | Status |
|----|---------|---------------------------|--------|
| BT-1 | Business Texting activation | Settings → Messaging | **Partial** — existing settings + activation panel on Campaigns |
| BT-2 | Approved sender status display | Settings → Messaging; campaign composer | **Partial** — sender badge + gate via `assertMassTextMarketingSendAllowed` |
| BT-3 | Contacts usable for messaging | `/contacts` | Partial — shared model exists |
| BT-4 | CSV-imported contacts usable for campaigns | `/contacts/imports` | Partial |
| BT-5 | Segments as campaign audiences | `/contacts/segments` | Partial |
| BT-6 | Campaign list | `/appointments/campaigns` | **Implemented** (reuse legacy UI + runtime) |
| BT-7 | Create campaign | `/appointments/campaigns/new` | **Implemented** (reuse legacy flow) |
| BT-8 | Audience selection | Campaign compose step 1 | Reuse legacy |
| BT-9 | SMS composer | Campaign compose step 2 | Reuse legacy |
| BT-10 | Template selection | Link to `/appointments/automations/templates` | Audit needed |
| BT-11 | Send now | Campaign review / launch | Reuse legacy runtime |
| BT-12 | Schedule send | Campaign compose / review | Reuse legacy runtime |
| BT-13 | Review + attestation | `/appointments/campaigns/new/review` | Reuse legacy |
| BT-14 | Campaign send runtime | BullMQ + `src/lib/mass-texting/broadcast/` | Reuse as-is |
| BT-15 | Campaign status (draft/scheduled/sending/sent/failed) | List + detail | Reuse legacy |
| BT-16 | Campaign results | `/appointments/campaigns/[id]` | Reuse legacy |
| BT-17 | Campaign replies → Inbox | `/conversations` | Reuse as-is |
| BT-18 | STOP / suppression enforcement | Messaging runtime | Reuse as-is |
| BT-19 | Contact → Inbox messaging | Contact detail → Inbox | Planned |
| BT-20 | Link tracking / attribution | Campaign detail (if mature) | Audit — defer if risky |

## Sidebar IA (final target)

```
MESSAGES
  Inbox          → /conversations
  Campaigns      → /appointments/campaigns

CONTACTS
  Contacts       → /contacts
  Segments       → /contacts/segments
  Import         → /contacts/imports
  Fields         → /contacts/fields

SETTINGS
  Messaging      → /settings/messaging (Business Texting activation)
```

## Intentionally NOT restored

- SMS Dashboard, old Send page, generic SMS Automations, Flow Builder
- Grow, Keywords, Contests, Popups, Website forms, Click-to-text, QR suite
- Standalone SMS Reports, Phone Numbers nav, Compliance nav
- MCTB, Smart Routing, AI Receptionist (separate products)

## Campaign gating

- **Inactive sender:** Campaigns discoverable; show activation state with CTA to Settings → Messaging
- **Active approved sender:** Full campaign composer, send, schedule
- Transactional appointment reminders remain separate from Business Texting campaigns

## Visual integration

- Preserve strong legacy Campaign page **layout/workflow**
- Strip old SMS product shell; use Appointments header, sidebar, typography, tokens
- Route `/appointments/campaigns/*` inherits Appointments pilot theme via parent layout

## Completion gates

See absorption audit (`docs/APPOINTMENTS-BUSINESS-TEXTING-ABSORPTION-AUDIT.md`) and certification pause notice (`docs/APPOINTMENTS-BUSINESS-TEXTING-CERTIFICATION-PAUSE.md`).

## Related documents

- `docs/APPOINTMENTS-BUSINESS-TEXTING-ABSORPTION-AUDIT.md` — mechanical inventory
- `docs/APPOINTMENTS-BUSINESS-TEXTING-CERTIFICATION-PAUSE.md` — certification hold
- `docs/MASS_TEXTING_GLUE_FLOWS.md` — campaign glue flows
- `src/lib/products/business-texting-routes.ts` — canonical route helpers
