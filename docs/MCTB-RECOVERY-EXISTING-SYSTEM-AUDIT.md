# MCTB Recovery — existing system audit

## Canonical route (post-consolidation)

| Item | Value |
|------|--------|
| User-facing page | `/mctb/setup/recovery` (`MCTB_ROUTES.setupRecovery`) |
| View | `src/components/mctb/setup/setup-recovery-view.tsx` |
| Legacy redirects | `/mctb/setup/missed-call-rules` → Recovery; `/mctb/setup/follow-up` → Recovery (existing) |

## Prior UI split (merged)

| Old surface | File | Backend |
|-------------|------|---------|
| Missed-call rules | `setup-missed-call-rules-view.tsx` | `POST /api/mctb/setup` `triggerRules` |
| Recovery controls | `recovery-controls-view.tsx` | `POST /api/mctb/setup` `pauseUntil`, `enabled`, `cooldownMinutes` |

**Field mapping**

| Old UI field | Action | New location |
|--------------|--------|--------------|
| sendAfterNoAnswer/Busy/Rejected/Timeout/Voicemail | **MERGE** | Recovery § What counts as a missed call |
| cooldownMinutes | **MERGE** | Recovery § Repeat callers |
| enabled + pauseUntil + pause presets | **MERGE** | Recovery § Recovery status + pause modal |
| Pause copy / resume | **MERGE** | Header + status strip (not Save) |
| Link to recovery for cooldown | **REMOVE_FROM_UI** | N/A (single page) |
| follow-up rules message | **MOVE** | Guardrail link → Text Back (`/mctb/setup/text-back`) |
| Message template editor | **MOVE** | Text Back page (summary preview only on Recovery) |
| Consent configuration | **READ_ONLY** | Summary + link to Consent |
| Exclusions | **READ_ONLY** | Suppression explainer + missed calls |
| Forwarding | **READ_ONLY** | Warning strip → Phone & Forwarding |

## Runtime config (read/write)

Source: `missedCallTextConfig` via `loadMissedCallTextConfig` / `updateMissedCallTextConfig`.

| Field | Meaning |
|-------|---------|
| `enabled` | Global recovery agent on/off (pause manual sets false) |
| `sendAfterNoAnswer` | No-answer triggers recovery event |
| `sendAfterBusy` | Busy |
| `sendAfterRejected` | Rejected |
| `sendAfterTimeout` | Unreachable / timeout |
| `sendAfterVoicemail` | Voicemail detected on call path |
| `cooldownMinutes` | Repeat-caller suppression window |
| `maxMessagesPerCaller` | Max sends per caller in cooldown window (default 1) |
| `delaySeconds` | Delay before recovery SMS |
| `requireCarrierForward` | Production requires forwarded ingress (eligibility) |

## Pause / schedule

- Workspace `customFieldsConfig.mctb.pauseUntil`, `manuallyPaused`, `scheduleMode`, `weeklySchedule`
- Helpers: `src/lib/mctb/schedule.ts`, `schedule-shared.ts` (`addPauseUntil`, `isMctbSchedulePaused`)
- Pause API: `POST /api/mctb/setup` with `{ pauseUntil }` (timed) or `{ enabled: false, pauseUntil: null }` (manual)
- Resume: `{ enabled: true, pauseUntil: null }`
- **Pause does not alter TeXML/voicemail routing** — only suppresses automatic recovery SMS via `MCTB_DISABLED` in eligibility.

## Eligibility engine

`evaluateMissedCallTextEligibility` (`src/lib/agents/missed-call-text-back/eligibility.ts`):

1. Normalize caller / invalid phone
2. `config.enabled` → `FEATURE_DISABLED`
3. Entitlement / trial limits
4. Classification (answered/outbound/not missed)
5. `classificationTriggersMctb` → `NOT_MISSED` / trigger flags → `TRIGGER_DISABLED`
6. Carrier forward requirement → `NOT_FORWARD_EVENT`
7. Spam filter
8. Idempotency / `ALREADY_SENT`
9. Exclusions → `BLOCKED_NUMBER`
10. Opt-out → `OPTED_OUT`
11. Cooldown + `maxMessagesPerCaller` → `COOLDOWN_ACTIVE`
12. Schedule pause → `MCTB_DISABLED`
13. Send window → `OUTSIDE_SEND_WINDOW`

Consent and messaging approval are enforced downstream of eligibility (voice/SMS pipeline).

## APIs used by consolidated page

| Action | Endpoint |
|--------|----------|
| Load/save triggers, cooldown, delay | `GET/POST /api/mctb/setup` |
| Pause/resume | `POST /api/mctb/setup` |
| Forwarding verified flag | `GET /api/mctb/onboarding` |
| Recent suppressions | `GET /api/mctb/missed-calls?status=suppressed` |
| Last recovery | `GET /api/mctb/missed-calls` (sent events) |
| Voicemail readiness | `GET /api/phone/voicemail?phoneNumberId=` |

## Not exposed in setup POST (unchanged)

- `maxMessagesPerCaller` — read-only in UI (default 1)
- `conversationEnabled` — runtime only
- Follow-up message/delay — solution flow config via Text Back / solution save

## Frontend-only / unwired on old pages

- None identified as no-ops; both old pages posted to `/api/mctb/setup`.
