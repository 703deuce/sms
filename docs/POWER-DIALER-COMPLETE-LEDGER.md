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
| P18 | Number-pool UI | caller-id-resolution | campaigns | B5 | not started | |
| P19 | Free registration guidance | number-health UI | number-health | B5 | not started | |
| P20 | Callback routing | campaign-extended-config `callbackRoutingMode`, callbacks priority | campaigns | B4 | partial | Schema + callback priority; campaign editor routing mode UI not wired |
| P21 | Number purchase/rep assign | Numbers integration | settings | B5 | not started | |
| P22 | Frequency limits | dial-policy, eligibility, CRM settings | compliance, CRM settings | B3 | done | Workspace min gap + daily cap + area codes (`dialPolicyJson`) |
| P23 | PD recording settings | power-dialer-recording | settings, webhooks | B1 | in progress | independent of Phone global |
| P24 | Legal/usage notices | compliance settings | settings | B5 | not started | counsel gate |
| P25 | Call source display | call-list-filters | call-history | B6 | not started | |
| P26 | Pickup analytics | analytics-service, analytics UI | analytics | B1 | done | denominator + classification panel |
| P27 | Real AI summaries | transcription | call-history | B6 | not started | |
| P28 | Agent number enforcement | caller-id-resolution | team, dialer | B1 | in progress | repNumberAssignments |
| P29 | CRM writeback | crm-sync-bridge | integrations | B7 | not started | SF/Zoho/Pipedrive only |
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
| M12 | Shared team queues | team-queue-claims, session-runtime | runtime | B4 | done | Claims + round-robin ordering; live multi-agent needs PSTN smoke |
| M13 | Abandoned-call handling | parallel safety | analytics | B8 | not started | |
| M14 | Alternate-number fallthrough | phone-fallthrough, session-runtime | dialer | B2 | done | next_number/next_contact in CRM settings |
| M15 | In-session number mgmt | contact API, UI | dialer | B1 | in progress | |
| M16 | Mini CRM folders/views | folders API, contacts-folder-tree | `/app/contacts` | B2/B3 | done | Folder tree, filter, bulk move into folder |
| M17 | CRM list sync | crm-list-import | lists | B7 | not started | existing CRMs |
| M18 | List API add/remove | public API | integrations | B7 | not started | |
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
| M34 | Owner/tags/CRM actions | disposition-actions | runtime | B4 | partial | tag/task/owner; voicemail/CRM email actions partial |
| M35 | Disposition SMS | disposition-messaging | runtime | B4 | done | DNC + quiet hours + sendQuickSms |
| M36 | Disposition webhooks | — | — | B4 | not done | Deferred to M81 customer webhooks |
| M37 | Cadences | PowerDialerCadence models, cadence-engine, API | settings | B4 | partial | Engine + API; limited admin UI |
| M38 | Call ratings + ACW | acw-enforcement (prior) | dialer | B1 | done | |
| M39 | Admin scripts | scripts API (prior) | settings | B1 | partial | Assignment UI unchanged |
| M49 | Callback routing pools | callbacks-service priority/visibility/source | callbacks | B4 | done | Ordering + source column UI |
| M74 | AI receptionist → PD | ai-callback-bridge, `/api/phone/power-dialer/ai-callbacks` | API | B4 | done | Callback/enroll with source |
| M75 | Session email | send-email API, disposition-messaging | dialer | B4 | partial | API + settings gate; webhook provider required |
| M38 | Call ratings + ACW timeout | acw-enforcement, settings | dialer | B1 | done | `afterCallWorkTimeoutSec`, ratings gate |
| M40 | Beep detection auto-drop | beep-auto-drop + AMD | dialer | B1 | done | default OFF; Telnyx machine_end_* |
| M41 | Screening intro copy | screener-intro-playback | settings | B1 | done | truthful TTS/recorded |
| M42 | Abandonment messages | compliance | B8 | not started | counsel |
| M43–M53 | Numbers/reputation | number-health | number-health | B5 | not started | |
| M54–M59 | Compliance/recording | compliance panels | settings | B5 | not started | |
| M60–M68 | Reporting/intelligence | analytics-service | analytics | B6 | not started | |
| M69–M73 | Team/permissions | team-settings | settings | B6 | not started | |
| M76 | CRM field sync | crm mappings | integrations | B7 | not started | |
| M77 | HubSpot | — | — | — | **EXCLUDED** | owner |
| M78 | GoHighLevel | — | — | — | **EXCLUDED** | owner |
| M79 | Other new CRMs | — | — | — | **EXCLUDED** | owner |
| M80 | Zapier-compatible API | webhooks API | integrations | B7 | not started | |
| M81 | Customer webhooks | webhook delivery | integrations | B7 | not started | |
| M82 | Public API | API keys | integrations | B7 | not started | |
| M83 | Browser extension | extension | integrations | B7 | not started | |
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
| Batch4 + B3 leftovers | *(this run — see git log)* | `test:power-dialer-batch4-b3`, `test:power-dialer-batch3` PASS; migration `20261024120000` |

## Live verification still required

- Multi-rep team queue: two agents, same campaign, confirm no duplicate contact claims under concurrent sessions.
- Standby waterfall with real list sizes and exhausted primary.
- Disposition-triggered SMS on production Telnyx sender (not env stub).
- PSTN parallel/AMD paths unchanged; warm transfer still B8/M06.
