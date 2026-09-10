# Blueprint 58 — Settings + Security

**Routes:** `/settings/business`, `/settings/users`, `/settings/messaging`, `/settings/calendar`, `/settings/ai-notetaker`, `/settings/security`, `/settings/billing`

## BATCH 8B-6 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 18-3 | Org roles API | Settings → Team / Security | `org-permissions.ts` | ABSORBED_CANONICAL_UI |
| — | Booking access controls | Security → Enterprise link | `/appointments/enterprise` | ABSORBED_CANONICAL_UI |
| — | SAML / SCIM | Security truth panel | — | PROVIDER_BLOCKED |
| — | Meeting / notetaker defaults | `/settings/ai-notetaker` | settings API | ALREADY_PRESENT |

## AUDIT CORRECTIONS

| Feature ID | Wrong | Correct |
|---|---|---|
| 18-3 | POS | Settings → Team / Security |

## REMAINING GAPS

- Per-booking-type permission editor on type Advanced (STILL_MISSING partial UI)
- Full SAML/SCIM implementation (PROVIDER_BLOCKED)
