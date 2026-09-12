# MCTB Recovery — component connection matrix

| COMPONENT | SOURCE | WRITE ACTION | PERSISTENCE | RUNTIME EFFECT | ERROR STATE | STATUS |
|-----------|--------|--------------|-------------|----------------|-------------|--------|
| Recovery status strip | setup `schedule` + runtime | — | — | Display | — | READ_ONLY_BY_DESIGN |
| Pause recovery menu | `schedule`, `enabled` | `POST /api/mctb/setup` pause fields | `mctb.pauseUntil`, `enabled` | `MCTB_DISABLED` when paused | Banner | CONNECTED_AND_WORKING |
| Resume recovery | same | `enabled: true`, `pauseUntil: null` | same | Resumes SMS | Banner | CONNECTED_AND_WORKING |
| Save changes | dirty snapshot | `triggerRules`, `cooldownMinutes`, `delaySeconds` | `missedCallTextConfig` | Trigger + cooldown + delay | Banner, validation | CONNECTED_AND_WORKING |
| Outcome toggles | runtime `sendAfter*` | via Save → `triggerRules` | DB config | `classificationTriggersMctb` | ≥1 trigger required | CONNECTED_AND_WORKING |
| Cooldown presets | `cooldownMinutes` | via Save | DB config | `COOLDOWN_ACTIVE` window | Save error | CONNECTED_AND_WORKING |
| Custom cooldown | same | via Save | same | same | Save error | CONNECTED_AND_WORKING |
| Repeat caller copy rows | eligibility logic | — | — | Explanatory | — | READ_ONLY_BY_DESIGN |
| Max attempts display | `maxMessagesPerCaller` | — | DB (not in setup POST) | Cooldown count | — | READ_ONLY_BY_DESIGN |
| Recovery delay modal | `delaySeconds` | via Save | DB + solution delay | Schedule delay | Modal | CONNECTED_AND_WORKING |
| Follow-up guardrail | `solution.config.followUpEnabled` | — | solution setup | Flow graph | Link to Text Back | READ_ONLY_BY_DESIGN |
| After-hours row | `schedule.scheduleMode` | — | workspace mctb | `OUTSIDE_SEND_WINDOW` | — | READ_ONLY_BY_DESIGN |
| Why not send list | suppression codes | — | — | Education | — | READ_ONLY_BY_DESIGN |
| Recovery summary rail | setup + onboarding + VM API | — | — | — | — | READ_ONLY_BY_DESIGN |
| Consent row | `consentMode` | — | workspace mctb | Consent pipeline | Link | READ_ONLY_BY_DESIGN |
| Text-back preview | `messageTemplate` | — | config | SMS body | Link | READ_ONLY_BY_DESIGN |
| Forwarding warning | onboarding verification | — | — | `NOT_FORWARD_EVENT` risk | Link | READ_ONLY_BY_DESIGN |
| Recent suppressions | `/api/mctb/missed-calls` | — | events table | — | Empty state | CONNECTED_AND_WORKING |
| View missed calls | — | navigation | — | — | — | READ_ONLY_BY_DESIGN |
| Run connection test | — | navigation | — | — | — | READ_ONLY_BY_DESIGN |

**BROKEN = 0 · NO_OP = 0 · PLACEHOLDER = 0**
