# Blueprint 61 — Meetings Recaps (`/meetings`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-7 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 14-4 | Meeting recaps / notetaker | Recaps list + detail | meeting-assistant | ABSORBED_CANONICAL_UI |
| 14-5 | Public shared recap | Share modal → `/recap/[token]` | recap runtime | RUNTIME_UI_EFFECT |

## CHANGES

- Recaps list fetches `source=all` (includes Transovo Video + external)
- Helper copy aligned to recap job (not notetaker-only)

## REMAINING GAPS

- Transcript search (nice-to-have)
- Retry failed summary when backend supports explicit retry action
