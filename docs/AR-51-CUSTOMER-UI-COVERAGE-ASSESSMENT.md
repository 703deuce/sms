# Appointment Reminders — 51-feature customer UI coverage assessment

**Question:** For all 51 checklist items, does the customer have UI to configure, change, and use each feature—not only “does the code exist?”

**Short answer:** **No.** A large portion is **runtime/automatic** (no knobs needed). Several items are **backend-ready with weak or missing customer controls.**

**Production UI stack:** Appointment Reminders routes use `src/newui-transplant/` (Opus kit: `Page`, `Panel`, `Tabs`, `Sheet`, `SimpleSelect`, etc.). The standalone `newui2/` folder is a reference/sandbox—not what ships for AR. Booking services/meetings under `/appointment-reminders/booking/*` still mix legacy `@/components/appointments` in places (separate from the reminder sequence/template path).

---

## How to read the labels

| Label | Meaning |
|--------|--------|
| **Full UI** | Customer can set it, change it, save it, and it affects sends. |
| **Partial UI** | Some control exists; important knobs missing or buried. |
| **Ops / automatic** | Works without a settings screen (or only staff/ops sees it). |
| **Deferred** | Not in customer product. |

---

## Priority 1 (items 1–16)

| # | Feature | Customer UI? |
|---|---------|----------------|
| 1 | Microsoft sync | **Partial** — Calendars/integrations + import selection; not a full “sync console.” |
| 2 | SMS reminders | **Ops** — On/off via steps + activation; no separate “SMS master switch” beyond that. |
| 3 | Email reminders | **Full** — Per-step channel + email subject/body (when allowed). |
| 4 | Multiple reminders | **Full** — Sequence + **Add step** + timing per step. |
| 5 | Per-step channel | **Full** — Per step in editor. |
| 6 | Custom timing | **Full** — Amount + unit on timeline; presets tab for bundles. |
| 7 | SMS templates | **Partial** — Industry pack + message type per step; **no** full 306-template browser; SMS **locked** on platform sender. |
| 8 | Email templates | **Partial** — Same picker + editor; not a dedicated email-template manager. |
| 9 | Personalization / merge fields | **Partial** — Insert variables + custom fields in **Scheduling & rules**; **no** AR screen for business name/phone/address (workspace/branding only). |
| 10 | Calendar → Transovo updates | **Ops** — Automatic on sync. |
| 11 | Phone/email mapping | **Partial** — Drawer: edit phone + channel pref; **email** in same API but **not** a clear email field in drawer; missing/invalid surfaced on list. |
| 12 | Timezones & quiet hours | **Partial** — Per-step skip weekends/off-hours/closed; workspace **weekly hours** not a dedicated AR “quiet hours” page (lives in broader config/engine). |
| 13 | SMS consent / opt-out | **Partial** — Shown in drawer; **no** AR consent editor (compliance elsewhere); enforcement is backend. |
| 14 | Email sender readiness | **Partial** — Shown at **activation**; **no** “fix email DNS” wizard in AR. |
| 15 | Delivery tracking | **Partial** — **Delivery ledger** on appointment; **no** workspace-wide delivery inbox like a campaign tool. |
| 16 | 3-step onboarding | **Partial** — Connect → Configure (**one** “general starter” button) → Activate; **not** full industry/tone/schedule onboarding form. |

---

## Priority 2 (items 17–33)

| # | Feature | Customer UI? |
|---|---------|----------------|
| 17 | Two-way SMS C/R/X | **Partial** — AI rescheduler settings + inbox behavior; not one “enable C/R/X” on reminder settings. |
| 18 | Email confirm buttons | **Full** — Links in templates; public action routes (customer-facing, not admin UI). |
| 19 | Confirmation status | **Partial** — Pills + drawer engagement; **no** single “confirmation center” page. |
| 20 | Cancel by SMS/email | **Partial** — Customer actions + AI tools; not a simple “allow cancel replies” toggle on reminders. |
| 21 | Reschedule links | **Partial** — Templates + AI rescheduler; self-serve link flow exists for customers, admin is fragmented. |
| 22 | Confirm/reschedule dashboard | **Partial** — Overview + appointments + drawer; **not** one dedicated dashboard. |
| 23 | Branded HTML email | **Partial** — Logo/color in **Presets & email**; not full HTML builder. |
| 24 | ICS attachments | **Ops** — On for email steps; **no** per-step “attach ICS” toggle in UI (if engine supports it, it’s not exposed clearly). |
| 25 | Industry templates | **Full** — Presets + per-step industry pack (not a catalog grid). |
| 26 | Timing presets | **Full** — Presets tab. |
| 27 | Lead-time rules | **Full** — Minimum lead time in **Scheduling & rules**. |
| 28 | Previews | **Full** — Step editor + **Customer preview** tab + tests. |
| 29 | Preparation instructions | **Full** — Presets & email tab field. |
| 30 | Contact/directions merge | **Partial** — Variables in editor; **directions URL / business phone** not a clear AR “business profile” block. |
| 31 | Basic analytics | **Full** — `/appointment-reminders/analytics`. |
| 32 | Duplicate prevention | **Ops** — No customer UI (correct). |
| 33 | Per-appointment history | **Partial** — Drawer timeline + ledger; reminders log page may not show **all** channels in one polished view. |

---

## Priority 3 + exception (items 34–51)

| # | Feature | Customer UI? |
|---|---------|----------------|
| 34 | Manual appointment | **Full** — Appointments UI. |
| 35 | CSV import | **Full** — Import sheet on appointments. |
| 36 | Google | **Deferred** |
| 37 | Custom reminder fields | **Full** — Scheduling & rules (key=value list). |
| 38 | Tone presets | **Full** — Presets tab (tone does not change library bodies today—**product gap** if tone was supposed to rewrite copy). |
| 39 | Cancellation policy | **Full** — Presets tab. |
| 40 | Confirmation-aware skips | **Full** — Workspace checkbox + per-step “skip if confirmed.” |
| 41 | Multilingual | **Partial** — Locale tag only; **no** language picker per template content. |
| 42 | Advanced analytics | **Full** — Analytics page (scope of “advanced” vs checklist may differ). |
| 43–44 | No-show + calculator | **Full** — Analytics + attendance on appointments. |
| 45 | Booking confirmation on import | **Ops** — Automatic; **one** checkbox for historical import skip in scheduling prefs (not obvious “when to send booking confirm”). |
| 46 | Calendar send-time controls | **Partial** — Per-step skips; **no** named “evening before / morning of” presets in UI. |
| 47 | Rules by appointment type | **Full** — Service rules in **Scheduling & rules** (text match, disable steps, channel override). |
| 48–49 | iCal feed / iCloud | **Deferred** |
| 50 | Recipient notification prefs | **Partial** — Default in scheduling + per-appointment in drawer; **not** on Contacts. |
| 51 | Write-back | **Ops** — Happens on reschedule/cancel; **no** “enable write-back” AR toggle (should stay automatic). |

---

## Bottom line

- **Roughly half** of the 51 are **fully customer-operable** in AR settings/appointments/onboarding for what they are (sequence, presets, scheduling rules, analytics, import, many template flows).
- **A big block** is **partial**: templates (picker yes, catalog no; SMS lock), **business identity for merge fields**, **onboarding configure**, **email/phone completeness in drawer**, **confirmation/reschedule as one admin home**, **weekly/quiet hours as first-class AR settings**.
- **Another block** is **correctly without UI** (sync engine, dedupe, write-back, much of delivery pipeline).
- **Templates are only one slice** of that partial list—not the whole story.

**We did not ship “51 features each with a complete customer settings surface.”** We shipped **engine + Opus UI for the core reminder loop**, with **gaps where customers still can’t set what the backend already supports.**

---

## Where customers *do* control things today (reminder path)

| Surface | Route / location | What they can do |
|---------|------------------|------------------|
| Drip sequence | `/appointment-reminders/settings` → Reminder sequence | Enable steps, timing, channel, add steps, edit step |
| Templates | Presets tab + step **Edit** | Industry pack, message type, edit copy (email; SMS if not platform-locked), preview, tests |
| Scheduling | Scheduling & rules tab | Lead time, default channel, locale, custom merge fields, service rules, historical import skip |
| Appointments | `/appointment-reminders/appointments` | Manual add, CSV, drawer: phone, notification preference, delivery ledger |
| Onboarding | `/appointment-reminders/setup/*` | Connect calendar, apply general starter pack, activate |
| Analytics | `/appointment-reminders/analytics` | KPIs, no-show calculator |

**Not provided today**

- Browse-all-306-templates gallery
- AR **Business profile** form (name, phone, address for merge vars)
- Onboarding configure = full preset form (industry, tone, timing)
- Clear **email** field in appointment drawer (API supports it)
- Single admin **confirmation/reschedule dashboard**
- Assign library types (reschedule notice, cancellation, follow-up) to drip steps in UI

---

## Recommended “customer operability” follow-up (UI only)

If the bar is “customer can change everything that’s configurable”:

1. **AR Business profile** on settings + onboarding (name, phone, address, logo → merge vars).
2. **Onboarding configure** = same controls as **Presets** tab (industry, tone, timing), not one button.
3. **Appointment drawer** — visible **email** field + validation, same as phone.
4. **Optional** template catalog panel (browse 306; still one library API).
5. **Expose** engine toggles product cares about (e.g. per-step ICS attach) if required by checklist.

---

## Related docs

- `docs/AR-51-FEATURE-RECONCILIATION-2026-10-10.md` — implementation status per #1–51
- `docs/AR-51-FEATURE-HAVE-VS-MISSING-2026-10-10.md` — earlier evidence-based inventory
- `docs/AR-PRODUCT-IMPLEMENTATION-COMPLETION.md` — Oct 10 implementation pass notes

**Assessment date:** 2026-10-10
