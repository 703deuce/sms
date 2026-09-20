# Google Calendar OAuth — verification & Limited Use (internal)

**Status:** Living document for Google OAuth scope review submission. Fill in during/after implementation; must match production behavior.

**Engineering reference:** `docs/GOOGLE-CALENDAR-INTEGRATION-ENGINEERING-GUIDE.md`  
**Build directive:** `docs/GOOGLE-CALENDAR-VOICE-V3-IMPLEMENTATION-DIRECTIVE.md`

Do not commit secrets, tokens, or client secrets in this file.

---

## Requested scope

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/calendar.events.owned` | _(complete: why Transovo needs it — see guide §56)_ |

**Not requested (V1):** broad `calendar`, ACLs, CalendarList, FreeBusy, etc.

---

## Why the scope is needed

_(Describe product behavior: AI receptionist checks conflicts and creates/reschedules/cancels appointments on the connected user’s owned primary calendar.)_

---

## Google APIs used

| API | Methods | Scope |
|-----|---------|-------|
| Calendar API v3 | `events.list`, `events.get`, `events.insert`, `events.update`, `events.delete` | `calendar.events.owned` |

**Calendar ID (V1):** `primary`

---

## What Transovo reads

_(Bounded `events.list` for availability; `events.get` / bounded list for lookup; no full-calendar export to clients or models.)_

---

## What Transovo writes

_(Insert/update/delete events; `extendedProperties.private` correlation IDs; deterministic descriptions — guide §31.)_

---

## Voice V3 / Astra data flow

_(Document: normalized slots and appointment outcomes only; no raw Google payloads, tokens, or full calendar in prompts. Provider resolved from published wizard config — not chosen by Astra.)_

| Stage | Google data leaves integration layer? |
|-------|--------------------------------------|
| `find_availability` | _(slots only)_ |
| `book_appointment` | _(success + appointment facts)_ |
| `find_appointment` | _(candidates → deterministic match)_ |
| `reschedule_appointment` / `cancel_appointment` | _(outcomes only)_ |

---

## AI / service providers

_(Truthful list: which subprocessors may see scheduling outcomes vs never see Calendar credentials or full event dumps.)_

---

## Retention

_(How long connection credentials and appointment correlation metadata are kept; align with privacy policy.)_

---

## Disconnect / revocation

_(Disable provider; revoke/remove tokens per existing integration pattern; do not delete customer Google events.)_

---

## Limited Use & privacy policy

| Item | Location |
|------|----------|
| Google API Services User Data Policy / Limited Use | _(URL to production privacy policy section)_ |
| Last reviewed | _(date)_ |

---

## Demo video steps (consent screen)

1. Transovo → Integrations → Google Calendar → Connect  
2. Google OAuth → consent screen shows **exact** Calendar scope  
3. Approve → return to Transovo → **Connected** (primary calendar)  

_(Add screenshots or recording path when captured — no secrets.)_

---

## Reviewer FAQ (draft answers)

**Q: Why offline access?**  
A: _(Voice calls when business owner is not logged in; refresh token pattern.)_

**Q: Why not narrower scope?**  
A: _(Owned events scope is minimum for list/get/insert/update/delete on primary.)_

---

*Update this document when scope, APIs, or data flows change.*
