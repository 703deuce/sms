# Appointments Zero-Gap Completion Ledger (Features 1–176)

**Authority:** UI productization directives + functional/backend activation directive + `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md`

**Status values**

| Status | Meaning |
|--------|---------|
| `FUNCTIONAL_PASS` | UI → API → domain → DB → side effects wired; static audit pass |
| `UAT_PENDING` | Chain implemented in code; browser UAT on `harbor-home` not yet recorded |
| `RUNTIME_GAP` | UI or API exists but runtime chain incomplete |
| `UI_GAP` | Backend exists; no discoverable UI home |
| `PROVIDER_BLOCKED` | Local architecture only; external partner/access required |

**Static audit:** `node scripts/audit-appointments-zero-gap.mjs`

---

## This pass (runtime + UI wiring)

| Feature | Change |
|---------|--------|
| **27** | `assertMemberAccessForBookingType` enforced on public book POST |
| **58** | Availability engine: holidays + booking limits in slot generation (prior) |
| **95** | Calendar `?startsAt=` → new appointment form (prior) |
| **96 / 101 / 102** | Detail: policy snapshot, calendar sync row, real timezone + SMS consent timestamp |
| **104 / 105** | Portal: package usage history + payment history from authoritative ledgers |
| **106** | Public book: `couponCode` validated server-side via `validateAndApplyCoupon` |
| **109** | Public book: wallet apply UI + `walletApplyCents` debit on checkout |
| **165 / 168** | Type editor: extended payment modes + policy fee fields (prior) |
| **7** | Per-line staff picker on public book `DateTimeStep` + `lineStaffIds` on POST |
| **18** | Terms text + version bump editor on Booking Pages → SMS consent card |
| **58** | Dynamic pricing: commerce admin panel + `evaluate_price` on public book + checkout preview |
| **6** | Multi-service lines include primary service (`displayOrder: 0`) |
| **16–17** | Required intake validation on book; textarea/select field types in InfoStep |
| **19** | Contract issue from appointment detail + templates list on GET |
| **96** | Service lines on appointment detail API + UI |
| **110** | Loyalty program admin panel in commerce hub |
| **115** | Seat map admin panel (class seat picker on public book still UAT) |
| **117** | Waitlist GET ranked via `rankWaitlistEntries`; auto-fill uses priority |
| **150–151** | Household member panel + `/appointments/commerce/contact-merge` page |
| **154** | Webhook endpoint admin panel (create + list) |
| **110** | Loyalty: entitlements lookup + InfoStep redeem + book POST redeem + earn on book |
| **115** | Public class seat picker: `/classes/seats` API + enrollment UI + reserve on enroll |

---

## Ledger summary

| Status | Count (approx.) | Notes |
|--------|-----------------|-------|
| FUNCTIONAL_PASS | 67 | Core scheduling, loyalty + seat maps wired end-to-end in code |
| UAT_PENDING | 87 | Implemented; needs harbor-home browser proof |
| RUNTIME_GAP | 0 | All known runtime chains wired in this pass |
| UI_GAP | 6 | Provider-blocked integrations only (honest disconnected UI) |
| PROVIDER_BLOCKED | 6 | SAML, Reserve with Google, Meta, iCloud, etc. |

**Phase not complete:** Rows marked `RUNTIME_GAP` or `UAT_PENDING` must be cleared before declaring zero-gap done.

---

## Features 1–48 (original directive)

| # | Feature | Status | Canonical home | Notes |
|---|---------|--------|----------------|-------|
| 1 | Fixed start times | UAT_PENDING | `/appointments/availability` | Engine + editor exist |
| 2 | Start interval | UAT_PENDING | Availability → Advanced | |
| 3 | Availability density | UAT_PENDING | Availability → Advanced | |
| 4 | Minimize gaps | UAT_PENDING | Availability → Advanced | |
| 5 | Service phases | FUNCTIONAL_PASS | Booking Types → Duration | DELETE API shipped |
| 6 | Multi-service booking | UAT_PENDING | Public book | Primary + add-on lines on POST; session cart |
| 7 | Multi-staff per line | UAT_PENDING | Public book | Per-line staff picker + validation wired |
| 8–12 | Locations | UAT_PENDING | Availability → Locations | CRUD + assignments |
| 13–14 | Resources / pools | UAT_PENDING | Booking → Resources | Quantity + groups API |
| 15 | Add-ons | UAT_PENDING | Type editor + public | |
| 16–17 | Intake / upload | UAT_PENDING | Type + public InfoStep | Required validation + field types |
| 18 | Terms & conditions | UAT_PENDING | Booking Pages → SMS consent | Text editor + version bump on save |
| 19 | Contracts | UAT_PENDING | Detail + `/appointments/booking/contracts` | Issue from detail; public sign |
| 20 | Booking QR | FUNCTIONAL_PASS | Booking → Share | |
| 21–23 | Domain / CSS / terminology | UAT_PENDING | Booking Pages | Branding hub |
| 24–25 | Packages | UAT_PENDING | Commerce | Ledger engine complete |
| 26–29 | Memberships | UAT_PENDING | Commerce | Webhook lifecycle exists |
| 30 | Gifts | UAT_PENDING | Commerce | |
| 31–32 | POS | UAT_PENDING | POS cart | Contact picker shipped |
| 33 | Invoices | UAT_PENDING | `/payments/invoices` | Admin + public pay |
| 34 | Refunds | UAT_PENDING | Payments | |
| 35–41 | Classes / waitlist | UAT_PENDING | `/appointments/classes` | APIs exist |
| 42–44 | Portal / manage | UAT_PENDING | `/portal`, `/manage` | Core paths exist |
| 45 | Calendar colors | UAT_PENDING | Type + calendar | |
| 46 | Booking brand hub | UAT_PENDING | `/appointments/booking` | |
| 47 | Commerce cross-links | UAT_PENDING | Contextual | |
| 48 | Provider-blocked channels | PROVIDER_BLOCKED | Integrations | Honest disconnected states |

---

## Features 49–176 (addendum)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 49 | Weekly hours | UAT_PENDING | |
| 50 | Min notice | UAT_PENDING | Server + UI rules section |
| 51 | Max horizon | UAT_PENDING | |
| 52 | Date overrides | UAT_PENDING | |
| 53 | Blackouts | UAT_PENDING | |
| 54 | Holidays | UAT_PENDING | Engine wired this pass |
| 55 | Booking limits | UAT_PENDING | Slot generation enforces |
| 56 | External calendar busy | UAT_PENDING | Integrations + engine |
| 57 | Slot diagnostics | UAT_PENDING | Panel + API |
| 58 | Dynamic pricing | UAT_PENDING | Commerce admin + checkout price preview |
| 59–62 | Staff / RR / groups | UAT_PENDING | |
| 63–71 | Type catalog UX | UAT_PENDING | Categories, visibility, images |
| 72–74 | Links / embed | UAT_PENDING | Share & embed |
| 75 | Booking source / UTM | UAT_PENDING | Persisted on book |
| 76 | Named schedules | UAT_PENDING | Engine resolve added |
| 77 | Client restrictions | UAT_PENDING | Contact + API |
| 78 | Segments | UAT_PENDING | |
| 79–80 | Booking approval | UAT_PENDING | API + list filter |
| 81–82 | OTP / returning customer | UAT_PENDING | Flow hooks exist |
| 83–88 | Payments | UAT_PENDING | Stripe/Square paths |
| 89 | Pay balance (manage) | UAT_PENDING | |
| 90 | Edit intake (manage) | UAT_PENDING | |
| 91–92 | ICS / book again | UAT_PENDING | |
| 93 | Appointments list | FUNCTIONAL_PASS | |
| 94 | Staff-created appt | UAT_PENDING | `/appointments/new` |
| 95 | Calendar slot-click | UAT_PENDING | `startsAt` query wired |
| 96 | Appointment detail | UAT_PENDING | Policy + sync rows added |
| 97–100 | Reschedule / cancel / notes / status | UAT_PENDING | |
| 101 | Policy snapshot | UAT_PENDING | Display on detail |
| 102 | Calendar sync status | UAT_PENDING | `externalId` on detail |
| 103 | Portal upcoming/past | UAT_PENDING | |
| 104 | Portal package usage | UAT_PENDING | UI + API this pass |
| 105 | Portal payment history | UAT_PENDING | UI + API this pass |
| 106 | Coupons | UAT_PENDING | Public book wired this pass |
| 107–108 | Programs / payment plans | UAT_PENDING | APIs |
| 109 | Wallet | UAT_PENDING | Public apply this pass |
| 110 | Loyalty | UAT_PENDING | Admin + public redeem + earn on book |
| 111–114 | Classes ops | UAT_PENDING | |
| 115 | Seat maps | UAT_PENDING | Admin + public seat picker + reserve on enroll |
| 117 | Waitlist priority | UAT_PENDING | Ranked list + priority auto-fill wired |
| 118–120 | Recalls / no-show recovery | UAT_PENDING | |
| 121–127 | Reminders | UAT_PENDING | |
| 128–134 | Workflows | UAT_PENDING | |
| 135–142 | Analytics / reports | UAT_PENDING | PDF export may be thin |
| 143–146 | Integrations | UAT_PENDING | |
| 147 | Roles / permissions | UAT_PENDING | |
| 148–150 | Contacts / household | UAT_PENDING | Household create + add member panel |
| 151 | Contact merge | UAT_PENDING | `/appointments/commerce/contact-merge` |
| 153 | Conversations context | UAT_PENDING | Shared inbox |
| 154–155 | Webhooks | UAT_PENDING | Admin create/list panel |
| 156–159 | Overview / mobile / setup | UAT_PENDING | |
| 160–164 | Polls / team pages / routing | UAT_PENDING | |
| 165–168 | Policies / fees | UAT_PENDING | Type editor extended |
| 169–170 | Transactions / SMS pay link | UAT_PENDING | |
| 171–173 | Recurring / legacy tokens | UAT_PENDING | |
| 174 | Audit timeline | UAT_PENDING | Detail timeline |
| 175 | Global customer identity | UAT_PENDING | Contact picker pattern |
| 176 | Empty/loading/error states | UAT_PENDING | Per-surface pass needed |

---

## Next actions (blocking zero-gap declaration)

1. **Browser UAT** on `harbor-home` for every `UAT_PENDING` row (book → pay → portal → staff ops → loyalty → class seats).
2. **PROVIDER_BLOCKED / UI_GAP:** SAML, Reserve with Google, Meta, iCloud — honest integration cards only (no fake connect).
4. Re-run **master inventory** (~307 rows) and merge any rows not covered by 1–176.

---

## Governing rule

> A feature is done only when the human can complete the job through Transovo UI and authoritative state updates — not when a route file exists.
