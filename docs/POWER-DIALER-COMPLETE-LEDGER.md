# Power Dialer Complete Build — implementation ledger

**Branch:** `feature/power-dialer-complete` (all batches)  
**Baseline master:** `b673c76a0` (≥ `485275b3f`)  
**Coolify deploy:** `master` only — feature-branch pushes do not auto-deploy web app.

| ID | Requirement | DB / API / UI / runtime | Route | Batch | Status | Notes |
|----|-------------|-------------------------|-------|-------|--------|-------|
| P01 | Pause & Preview dial flow | session-runtime, power-dialer-session | `/app/power-dialer/dialer` | B1 | in progress | Preview hold + manual dial |
| P02 | Resume unfinished sessions | session-orchestration, sessions API | dialer | B1 | in progress | reconcile + resume |
| P03 | Upcoming-contact queue | session-orchestration, UI queue panel | dialer | B1 | in progress | next N eligible |
| P04 | Live mute/hold/transfer | workspace-provider, power-dialer-session, transfer API | dialer | B1 | done | cold transfer; warm 501 → **B8/M06** |
| P05 | CSV duplicate processing | list-import-apply | calling lists | B2 | done | imported/updated/invalid counts |
| P06 | Custom import fields | csv-import, custom-field defs, import apply | lists, settings | B2 | done | admin defs + typed values on import |
| P07 | Standard contact fields | dialer-contact-inline-edit, contact API | contacts, dialer | B2/B3 | done | Optimistic inline edit on dialer card |
| P08 | Timezone CSV mapping | csv-import validation | lists | B2 | done | IANA validate + infer flag |
| P09 | Multiple phone numbers | ContactPhone, phone-resolve, fallthrough | dialer, contact | B2 | done | M14 session override + dialedPhoneE164 |
| P10 | Complete session contact card | dialer-prep, session UI | dialer | B2 | done | link `/app/contacts/[id]` |
| P11 | CRM ownership routing | eligibility, reassign API | campaigns, contact | B2 | done | `assigned_only` + `PATCH` reassign_owner |
| P12 | Callback UI complete | callbacks-service, callbacks-content | `/app/power-dialer/callbacks` | B3 | done | Reschedule + notes; complete/cancel/start call |
| P13 | Timezone coverage | common-timezones, campaign editor | campaigns | B3 | done | IANA picker on campaign + contact TZ in eligibility |
| P14 | Campaign schedules | campaign-config, timezone-window, editor | campaigns | B3 | done | Allowed days, hours, breaks, jurisdiction presets |
| P15 | Disposition effects by flags | disposition-effects | settings, runtime | B1 | in progress | removeFromQueue, markCompleted |
| P16 | Require notes enforcement | session-runtime, UI | dialer | B1 | in progress | backend + UI |
| P17 | Screening runtime | screening-runtime, AMD | dialer, settings | B1 | in progress | |
| P18 | Number-pool UI | `caller-id-pool.ts`, `campaign-editor-sheet.tsx` Caller ID tab | campaigns | B5 | done | Pool checkboxes, rotation, local presence, daily cap; runtime `pickCampaignCallerId` |
| P19 | Free registration guidance | `number-health/free-tools/page.tsx` (existing) | number-health | B5 | done | Links + honest copy; no fake registration state |
| P20 | Callback routing | `callback-routing-runtime.ts`, `callbacks-service`, campaign editor Outcomes | campaigns | B4/B5 | done | Editor + runtime assignee/pool on create |
| P21 | Number purchase/rep assign | `/app/numbers`, `team-settings-panel.tsx` rep assignments | settings | B5 | done | Link to Numbers + `repNumberAssignments` UI/API |
| P22 | Frequency limits | dial-policy, eligibility, CRM settings | compliance, CRM settings | B3 | done | Workspace min gap + daily cap + area codes (`dialPolicyJson`) |
| P23 | PD recording settings | `recording-policy.ts`, `power-dialer-recording.ts`, settings copy | settings, webhooks | B5/B6 | done | Campaign > workspace > phone global for non-PD only; `test:power-dialer-recording-policy` |
| P24 | Legal/usage notices | `compliance-settings-panel.tsx`, compliance GET `legalNotice` | settings | B5 | done | Counsel review gate copy; not legal advice |
| P25 | Call source display | `call-source-label.ts`, `call-source-context.ts`, `calls-table.tsx`, `call-detail.tsx` | call-history | B6 | done | Campaign/list links from attempt session |
| P26 | Pickup analytics | analytics-service, analytics UI | analytics | B1 | done | denominator + classification panel |
| P27 | Real AI summaries | `call-intelligence.ts`, `human-call-transcription.ts`, `phone-ui-map.ts` | call-history | B6 | done | JSON intelligence labeled model-derived; gate: `DEEPGRAM_API_KEY` |
| P28 | Agent number enforcement | `caller-id-resolution.ts`, team settings | team, dialer | B1/B5 | done | `repNumberAssignments` at origination |
| P29 | CRM writeback | `crm-sync-bridge.ts`, disposition effects | integrations | B7 | done | SF/Zoho/Pipedrive via event bus; honest skip when disconnected |
| M01 | Hotkeys | power-dialer-session | dialer | B1 | in progress | a11y guards |
| M02 | Session presets | PowerDialerSessionPreset API | dialer | B1 | done | user + workspace scope |
| M03 | Cell/desk phone connect | Telnyx legs | dialer | B8 | not started | |
| M04 | Session convenience options | power-dialer.ts settings, settings-content panel | settings | B4 | done | Ring tone, duplicate skips, email toggle, 12/24h display |
| M05 | Manual live voicemail | live-voicemail API | dialer | B1 | done | distinct from prerecorded drop |
| M06 | 3-way / warm transfer | transfer.ts | dialer | B8 | not started | |
| M07 | Inbound during outbound | phone runtime | dialer | B8 | not started | |
| M08 | Parallel dialing | parallel orchestrator | dialer, campaigns | B8 | not started | visible mode |
| M09 | Machine-filtered parallel | AMD + parallel | dialer | B8 | not started | |
| M10 | Predictive pacing | predictive engine | campaigns | B8 | not started | gated |
| M11 | Dynamic dialer | session-queue-add, contact-actions `add_to_queue`, dialer UI | dialer | B4 | done | Live add with eligibility message |
| M12 | Shared team queues | `team-queue-claims.ts`, `caller-id-pool.advanceTeamQueuePointer`, session-runtime | runtime | B4/B5 | done | `teamQueuePointer` persisted per campaign on dial |
| M13 | Abandoned-call handling | parallel safety | analytics | B8 | not started | |
| M14 | Alternate-number fallthrough | phone-fallthrough, session-runtime | dialer | B2 | done | next_number/next_contact in CRM settings |
| M15 | In-session number mgmt | contact API, UI | dialer | B1 | in progress | |
| M16 | Mini CRM folders/views | folders API, contacts-folder-tree | `/app/contacts` | B2/B3 | done | Folder tree, filter, bulk move into folder |
| M17 | CRM list sync | `crm-list-import.ts`, `crm-inbound-sync.ts`, sync-inbound API | lists | B7 | done | Inbound + list import; connect required |
| M18 | List API add/remove | `/api/v1/power-dialer/lists/[id]/members` | integrations | B7 | done | Audited via API key + audit log |
| M19 | Country code / intl | dial-gates, createAttempt | dialer, settings | B2 | done | `assertOutboundDialAllowed` on dial |
| M20 | Rerun campaign | `rerun` API, campaign-admin | campaigns | B3 | done | Clears queue skip flags; optional completed reopen |
| M21 | Campaign completed status | campaign-admin, session-runtime, endSessionHard | campaigns | B4 | done | Auto on zero eligible; reversible via rerun (M20) |
| M22 | Multi-step retry | campaign-advanced, eligibility | campaigns | B3 | done | `retryScheduleMinutes` enforced |
| M23 | Dial ordering | queue-order, ContactListMember | campaigns | B3 | done | fifo/lifo/priority + manual sort order |
| M24 | List waterfall / standby | standby-queue, session-runtime, dialer queueContext | dialer | B4 | done | Drains standby lists; UI shows active list + reason |
| M25 | Callback injection | session-runtime, callbacks | dialer | B3 | done | Due callbacks prioritized for rep |
| M26 | Callback retry exempt | campaign-advanced, eligibility | campaigns | B3 | done | `callbackExemptFromRetryDelay` |
| M27 | In-session appointments | dialer-appointment-dialog, appointments API | dialer | B2/B3 | done | Modal from dialer card |
| M28 | Area-code TZ infer | timezone-infer (existing) | contacts | B2 | done | Approximate fallback only (prior) |
| M29 | Jurisdiction windows | timezone-window, campaign-advanced | campaigns | B3 | done | FTC preset + custom legal hours |
| M30 | Legal time restrictions | eligibility + timezone-window | runtime | B3 | done | Server enforced per contact TZ |
| M57 | Area-code allow/block | dial-policy, campaign editor, CRM settings | campaigns | B3 | done | Campaign + workspace layers |
| M31 | Live vs no-answer disposition sets | campaign-extended-config, dialer-prep, session-runtime | dialer | B4 | done | Separate set IDs + answerContext filter |
| M32 | Disposition follow-up engine | disposition-actions, disposition-effects | runtime | B4 | done | actionsJson + triggerFollowUp executes |
| M33 | Move/requeue lists | disposition-actions `add_to_list`/`remove_from_list` | runtime | B4 | done | |
| M34 | Owner/tags/CRM actions | `disposition-actions.ts`, `settings-library-panels.tsx` actions JSON | runtime | B4/B5 | done | vm drop (opt-in gate), crm_note, task, deal, email/SMS |
| M35 | Disposition SMS | disposition-messaging | runtime | B4 | done | DNC + quiet hours + sendQuickSms |
| M36 | Disposition webhooks | `disposition-actions.ts` `customer_webhook`, `disposition-effects.ts` | settings/runtime | B7 | done | M81 signed delivery + disposition.saved |
| M37 | Cadences | `cadence-engine.ts`, `cadences-settings-panel.tsx`, enrollments API | settings | B4/B5 | done | Builder JSON, enroll, pause/resume, per-contact list |
| M38 | Call ratings + ACW | acw-enforcement (prior) | dialer | B1 | done | |
| M39 | Admin scripts | `scripts/[id]` `assignmentJson`, `ScriptsLibraryPanel` team checkboxes | settings | B1/B5 | done | Team assignment on script edit |
| M49 | Callback routing pools | callbacks-service priority/visibility/source | callbacks | B4 | done | Ordering + source column UI |
| M74 | AI receptionist → PD | ai-callback-bridge, `/api/phone/power-dialer/ai-callbacks` | API | B4 | done | Callback/enroll with source |
| M75 | Session email | `lib/email/brevo.ts`, `disposition-messaging.ts` | dialer | B4/B5 | done | Brevo transactional; **gate:** `BREVO_API_KEY` + from email env |
| M38 | Call ratings + ACW timeout | acw-enforcement, settings | dialer | B1 | done | `afterCallWorkTimeoutSec`, ratings gate |
| M40 | Beep detection auto-drop | beep-auto-drop + AMD | dialer | B1 | done | default OFF; Telnyx machine_end_* |
| M41 | Screening intro copy | screener-intro-playback | settings | B1 | done | truthful TTS/recorded |
| M42 | Abandonment messages | compliance | B8 | not started | counsel |
| M43 | Caller ID rotation controls | `caller-id-pool.ts`, campaign editor | campaigns | B5 | done | sticky/rotate/local_presence; anti-evasion copy |
| M44 | Local presence | `caller-id-pool.ts` area-code match | runtime | B5 | done | Owned pool only |
| M45 | Number pools | campaign editor pool + Numbers link | campaigns | B5 | done | Inventory via global Numbers |
| M46 | Number health heuristics | `number-health-service.ts` `healthState` | number-health | B5 | done | Not carrier spam labels |
| M47 | Telnyx reputation | `number-health-service.ts` `telnyxReputationStatus` | number-health | B5 | external gate | Honest when not entitled/provisioned |
| M48 | Flag alerts / suppression | `number-health-signals.ts`, `number-health-service.ts`, UI | number-health | B5/B6 | done | 7d/30d metrics, healthy/watch/at_risk, rotate suggestion; **based on your call data** |
| M49 | Callback routing pools | (see P20) | callbacks | B4 | done | |
| M50 | CNAM/branded caller ID | — | — | B5 | external gate | Carrier product purchase |
| M51 | BYOC caller ID | — | — | B5 | external gate | Proof-of-control validation |
| M52 | Role-sensitive masking | `recording-access.ts` | settings | B5 | partial | Recording roles; full masking TBD |
| M53 | STIR/SHAKEN visibility | `number-health-service` `stirShakenAttestation` | number-health | B5 | done | Unknown when Telnyx omits |
| M54 | FTC National DNC | compliance external DNC toggle + workspace flags | compliance | B5 | external gate | Seller SAN/provider required |
| M55 | List consent exceptions | `list-consent.ts`, `ContactList.dialConsentJson`, compliance UI | lists | B5 | done | Attestation; no opt-out override |
| M56 | Contact consent fields | `compliance-gates.ts`, campaign `requireExplicitConsent` | runtime | B5 | done | consentSource/consentDate |
| M57 | Area-code allow/block | (prior B3) | campaigns | B3 | done | |
| M58 | Pause/resume recording | `recording-controls.ts`, attempts recording API | dialer | B5 | done | Telnyx record_start/stop |
| M59 | Abandoned metrics | `abandoned-metrics.ts`, compliance panel | compliance | B8 | deferred | **B8** — jurisdiction reporting periods + parallel abandon |
| M60 | CSV export attempts/sessions | `analytics/export/route.ts` | analytics API | B6 | done | `analytics_export` scope; `kind=sessions` |
| M61 | Disposition summary | `analytics-service.ts`, analytics UI tab | analytics | B6 | done | Real disposition counts |
| M62 | Funnel / activity reports | funnel + byHour + productivity in analytics | analytics | B6 | done | Dialed→connected→conversation→outcome |
| M63 | Scheduled email reports | `PowerDialerScheduledReport`, scheduled-reports API, UI | analytics | B6 | done | **Gate:** Brevo prod sender |
| M64 | Conversion by disposition | `analytics-conversion.ts` | analytics | B6 | done | markContactCompleted / outcomeClass success |
| M65 | Leaderboard | analytics `leaderboard` | analytics | B6 | done | By rep human conversations |
| M66 | Live call board | `getLiveDialerBoard`, live-board API, UI | analytics | B6 | done | Active/paused sessions poll |
| M67 | Supervisor coach | review API `supervisor.externalGate` | analytics | B6 | external gate | Telnyx monitor leg not provisioned |
| M68 | Conversation intelligence | `call-intelligence.ts`, attempt review API | call review | B6 | done | Keywords/sentiment/score; transcript_rules_v1 |
| M69 | Permission matrix | `power-dialer-permissions.ts`, team UI | settings/API | B6 | done | Scopes on analytics/settings/team/export |
| M70 | Supervisor role / login-as | `impersonation.ts`, banner, team panel, analytics filter | team | B7 | done | Start/stop, role hierarchy, audited |
| M71 | Team groups / campaign access | `team-settings-panel.tsx` (existing) | settings | B6 | done | Campaign member checkboxes |
| M72 | Manager vs rep data | `analyticsRepFilter` on analytics/export/review | API | B6 | done | CRM export manager+ only |
| M73 | DND / call waiting | team panel → Phone settings link | settings | B6 | done | Reuses shared Phone behavior |
| M76 | CRM field sync | `integration-settings.ts`, `sync-field-apply`, inbound sync | integrations | B7 | done | Bidirectional mappings + precedence locks |
| M77 | HubSpot | — | — | — | **EXCLUDED** | owner |
| M78 | GoHighLevel | — | — | — | **EXCLUDED** | owner |
| M79 | Other new CRMs | — | — | — | **EXCLUDED** | owner |
| M80 | Zapier-compatible API | `/api/v1/zapier/*`, `POWER-DIALER-ZAPIER-API.md` | integrations | B7 | done | REST hooks + polling + actions |
| M81 | Customer webhooks | `webhooks/delivery.ts`, developer UI, lifecycle emits | integrations | B7 | done | HMAC, retries, replay, test-send |
| M82 | Public API | `/api/v1/power-dialer/*`, `public-api/*`, OpenAPI | integrations | B7 | done | Scoped keys, rate limit, audit log |
| M83 | Browser extension | `extensions/click-to-call/` | integrations | B7 | done | MV3; not store-published |
| M84 | Native mobile apps | — | — | — | **EXCLUDED** | owner |
| M85 | Auto-create inbound contact | inbound-contact, calls-service | phone | B2 | done | min duration + rules in CRM settings |
| M86 | Billing dashboard | — | — | — | **EXCLUDED** | owner |
| X01 | AMD initialization | power-dialer-amd, answer-detection | Telnyx webhooks | B1 | in progress | see B1 architecture note |
| X02 | Server orchestration | session-orchestration | sessions API | B1 | in progress | |
| X03 | VM playback lifecycle | vm-drop, webhooks | attempts API | B1 | in progress | |
| X04 | PD recording runtime | power-dialer-recording | settings | B1 | in progress | |
| X05 | Disposition flags | disposition-effects | runtime | B1 | in progress | |
| X06 | Callback automation | callbacks-service | callbacks | B4 | not started | |
| X07 | CSV wizard completeness | csv-import-wizard | lists | B2/B3 | done | Custom field mapping, TZ column, dedupe, row errors, summary |
| X08 | Caller identity / rep numbers | caller-id-resolution | team | B1 | in progress | |
| X09 | Screening settings → runtime | screening-runtime | settings | B1 | in progress | |
| X10 | Honest data only | all surfaces | — | all | not started | ongoing |
| X11 | Bounded resource use | usage-limits, kill switch | settings | B1 | in progress | |
| C01 | CRM Contacts landing | contacts-workspace | `/app/contacts` | B2 | done | DB-backed list (existing) |
| C02 | Contact detail timeline | contact-detail-workspace, native API | `/app/contacts/[id]` | B2 | done | unified timeline + edit + quick actions |
| C03 | Companies | companies API + UI | `/app/contacts/companies` | B2 | done | list + detail |
| C04 | Deals / pipeline | deals API + kanban/table | `/app/contacts/deals` | B2 | done | stage move + editable stages API |
| C05 | Tasks & follow-ups | tasks API + UI | `/app/contacts/tasks` | B2 | done | buckets + campaign link field |
| C06 | Calendar / appointments | appointments API + UI | `/app/contacts/calendar` | B2 | done | week list + create |
| C07 | Saved views / folders | views/folders API, contacts filter | contacts | B2 | done | pinned views on list |
| C08 | Custom fields admin | custom-fields API + settings UI | CRM settings | B2 | done | text/number/select |
| C09 | Import/export CRM | merge/duplicates API, contact-merge-wizard | contacts, lists | B2/B3 | done | Duplicate groups, field winners, timeline, 10m undo |
| C10 | Unified activity timeline | contact-timeline | contact detail | B2 | done | calls/SMS/tasks/callbacks/recordings gate |

## B1 architecture — AMD (X01)

**Decision:** Power Dialer keeps the rep on **Telnyx WebRTC** (`client.newCall`) for media. AMD runs on the **linked Call Control leg** for that outbound call: when the browser links `telnyxCallControlId` to `HumanCall`, the server issues Telnyx `answering_machine_detection_start` (premium-capable) on that control ID. Webhooks `call.machine.detection.ended` / `call.machine.premium.detection.ended` feed `applyAmdToPowerDialerAttempt` with expanded result mapping (`human_residence`, `human_business`, `silence`, `fax_detected`, etc.). Future parallel mode (B8) will use **server-originated PSTN callee legs** (`dialPstnLeg` + bridge) with AMD on originate; B1 does not switch the default rep path to server-only originate.

**Rollback (B1+B2 migrations):** `20261023190000_power_dialer_b1_b2_native_crm`, `20261023200000_crm_b2b_columns` — drop new tables/columns in reverse order; revert application commits.

## Batch commits (feature branch)

| Batch | Commits | Tests |
|-------|---------|-------|
| B1 setup + docs | `67a830031` | — |
| B1 core engine | `85c8498b1` | `test:power-dialer-b1` PASS, `test:power-dialer-phase9` PASS |
| B1 carry-overs + B2 foundation | `5af852084` | `test:power-dialer-b1-carryovers`, `test:mini-crm-native`, `test:power-dialer-b1`, `test:power-dialer-phase9` PASS; `prisma migrate deploy` on scratch DB |
| B2b native CRM complete | `9d507f706` | `test:crm-native-b2`, `test:mini-crm-native`, `test:power-dialer-b1-carryovers` PASS; migrations `20261023200000` applied |
| Batch3 + B2 leftovers (server) | `48be73b54` | `test:power-dialer-batch3`, `test:power-dialer-b1-carryovers` PASS; migration `20261024100000` applied |
| Batch3 + B2 leftovers (UI) | `de58cd6aa` | Manual UI: merge wizard, folders, queue tab, campaign editor advanced, callbacks reschedule |
| Batch4 + B3 leftovers | `8ad7caacc`, `3ec1ec3a9`, `e92a00f0c` | `test:power-dialer-batch4-b3`, `test:power-dialer-batch3` PASS; migration `20261024120000` |
| Batch5 + B4 leftovers | `4e445fbb6`, `8f201b4d1`, `89f0b4645`, `5c4924c17` | `test:power-dialer-batch5-b4`, `test:power-dialer-batch4-b3` PASS; migration `20261024140000` |
| Batch6 + B5 leftovers | `0f4103c44`, `6470d4d9e`, `068b01e57`, `e8f6e4c8d` | `test:power-dialer-batch6` PASS; migration `20261024160000` |
| Batch7 + B6 leftovers | `32cfd5ece`, `071dff1da`, `f3eb70f23`, `e35ee86d8` | `test:power-dialer-batch7` PASS; migration `20261024180000`; full `tsc --noEmit` **RangeError stack overflow** (repo-wide, pre-existing); targeted `tsconfig.power-dialer-batch7.json` same |

## Live verification still required

- Multi-rep team queue: two agents, same campaign, confirm no duplicate contact claims under concurrent sessions.
- Standby waterfall with real list sizes and exhausted primary.
- Disposition-triggered SMS on production Telnyx sender.
- Brevo email from dialer/disposition (`BREVO_API_KEY`, `BREVO_FROM_EMAIL` or `TRANSOVO_TRANSACTIONAL_FROM_EMAIL`).
- Recording pause/resume on live Telnyx call.
- Multi-rep team queue + pool daily caps under real load.
- PSTN parallel/AMD paths unchanged; warm transfer still B8/M06.
- Live board with multiple active reps; supervisor listen/whisper/barge when Telnyx monitor leg exists.
- Deepgram transcription + conversation intelligence on recorded PD calls.
- Scheduled report email send with production Brevo credentials.
- M59 abandoned-call jurisdiction metrics (B8).
- Public API v1 + webhook delivery against real customer HTTPS endpoints (signing verification).
- Zapier REST hook subscribe with live Zap catch URL.
- CRM inbound sync + writeback on connected Salesforce/Zoho/Pipedrive sandbox.
- Click-to-call extension with active session + API key on production host.
- Impersonation login-as on manager account with audit log review.
