# MCTB exclusion reason & source map

Customer-facing labels are defined in `src/lib/mctb/setup-exclusions-model.ts`. Raw values below are **not** shown in the Exclusions UI.

## Source (`Suppression.source`)

| RAW VALUE | USER-FACING LABEL | MEANING | CREATED BY | RUNTIME EFFECT |
|-----------|-------------------|---------|------------|----------------|
| `mctb_exclusion` | Exclusions / Voicemail / … | Workspace MCTB do-not-recover row | Exclusions POST, voicemail block actions | `BLOCKED_NUMBER` when `suppressBlockedNumbers` |
| `personal_blocked` | Personal | Personal/account block list | `POST /api/personal/blocked` | Same phone/key lookup in eligibility |
| (other sources) | — | Not listed on MCTB Exclusions GET | Compliance, STOP, etc. | May suppress other channels; **not** on this page |

## Inferred origin (UI only, from `reason` when `source = mctb_exclusion`)

| SIGNAL IN `reason` | USER-FACING SOURCE |
|--------------------|--------------------|
| contains `voicemail` | Voicemail |
| contains `conversation` | Conversations |
| contains `missed` | Missed Calls |
| (else) | Exclusions |

## Reason strings (common)

| RAW / STORED VALUE | USER-FACING LABEL | MEANING | RUNTIME EFFECT |
|--------------------|-------------------|---------|----------------|
| `Do not text` | Manual exclusion | Default manual add | Recovery SMS suppressed |
| `Caller requested no recovery` | Caller requested no recovery | Manual preset | Same |
| `Blocked from voicemail` | Blocked from voicemail | Voicemail block action | Same |
| `Business request` | Business request | Manual preset | Same |
| `blocked_by_user` | Personal block | Personal blocked API | Same |
| `manual_block`, `do_not_recover` | Manual exclusion | Legacy/internal if present | Same |
| (custom free text) | Title-cased or as stored | User-entered reason | Same |

## Distinctions (not merged in UI)

| Concept | Separate? |
|---------|-----------|
| Exclusion list | `Suppression` rows above |
| STOP / carrier opt-out | Contact status + compliance |
| No consent | `NOT_EXISTING_CONSENT` suppression reason on events, not this table |
| Invalid phone | Eligibility `INVALID_PHONE` |
