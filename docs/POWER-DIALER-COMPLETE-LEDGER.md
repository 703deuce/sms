# Power Dialer Complete Build — implementation ledger

**Branch:** `feature/power-dialer-complete` (all batches)  
**Baseline master:** `b673c76a0` (≥ `485275b3f`)  
**Coolify deploy:** `master` only — feature-branch pushes do not auto-deploy web app.

| ID | Requirement | DB / API / UI / runtime | Route | Batch | Status | Notes |
|----|-------------|-------------------------|-------|-------|--------|-------|
| P01 | Pause & Preview dial flow | session-runtime, power-dialer-session | `/app/power-dialer/dialer` | B1 | in progress | Preview hold + manual dial |
| P02 | Resume unfinished sessions | session-orchestration, sessions API | dialer | B1 | in progress | reconcile + resume |
| P03 | Upcoming-contact queue | session-orchestration, UI queue panel | dialer | B1 | in progress | next N eligible |
| P04 | Live mute/hold/transfer | workspace-provider, power-dialer-session, transfer API | dialer | B1 | done | cold transfer via `transferHumanCall`; warm 501 |
| P05 | CSV duplicate processing | list-import-apply | calling lists | B2 | done | imported/updated/invalid counts |
| P06 | Custom import fields | csv-import mapping.custom | lists | B2 | partial | column map; admin defs C08 pending |
| P07 | Standard contact fields | csv-import, Contact cols | contacts | B2 | partial | title/email on import |
| P08 | Timezone CSV mapping | csv-import validation | lists | B2 | done | IANA validate + infer flag |
| P09 | Multiple phone numbers | ContactPhone, phone-resolve | dialer, contact | B2 | partial | import + resolve; M14 fallthrough pending |
| P10 | Complete session contact card | dialer-prep, session UI | dialer | B2 | done | link `/app/contacts/[id]` |
| P11 | CRM ownership routing | eligibility leadOwnerRouting | campaigns | B2 | partial | `assigned_only` enforced |
| P12 | Callback UI complete | callbacks-service | callbacks | B4 | not started | |
| P13 | Timezone coverage | timezone-window | campaigns | B3 | not started | |
| P14 | Campaign schedules | campaign-config | campaigns | B3 | not started | |
| P15 | Disposition effects by flags | disposition-effects | settings, runtime | B1 | in progress | removeFromQueue, markCompleted |
| P16 | Require notes enforcement | session-runtime, UI | dialer | B1 | in progress | backend + UI |
| P17 | Screening runtime | screening-runtime, AMD | dialer, settings | B1 | in progress | |
| P18 | Number-pool UI | caller-id-resolution | campaigns | B5 | not started | |
| P19 | Free registration guidance | number-health UI | number-health | B5 | not started | |
| P20 | Callback routing | campaign ext | campaigns | B5 | not started | |
| P21 | Number purchase/rep assign | Numbers integration | settings | B5 | not started | |
| P22 | Frequency limits | eligibility | compliance | B5 | not started | |
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
| M04 | Session convenience options | settings | settings | B3 | not started | |
| M05 | Manual live voicemail | live-voicemail API | dialer | B1 | done | distinct from prerecorded drop |
| M06 | 3-way / warm transfer | transfer.ts | dialer | B8 | not started | |
| M07 | Inbound during outbound | phone runtime | dialer | B8 | not started | |
| M08 | Parallel dialing | parallel orchestrator | dialer, campaigns | B8 | not started | visible mode |
| M09 | Machine-filtered parallel | AMD + parallel | dialer | B8 | not started | |
| M10 | Predictive pacing | predictive engine | campaigns | B8 | not started | gated |
| M11 | Dynamic dialer | session queue | campaigns | B3 | not started | |
| M12 | Shared team queues | campaign distribution | campaigns | B3 | not started | |
| M13 | Abandoned-call handling | parallel safety | analytics | B8 | not started | |
| M14 | Alternate-number fallthrough | phone-resolve, ContactPhone | dialer | B2 | partial | priority phones; session fallthrough pending |
| M15 | In-session number mgmt | contact API, UI | dialer | B1 | in progress | |
| M16 | Mini CRM folders/views | ContactFolder, SavedView schema | `/app/contacts` | B2 | partial | schema only; UI pending |
| M17 | CRM list sync | crm-list-import | lists | B7 | not started | existing CRMs |
| M18 | List API add/remove | public API | integrations | B7 | not started | |
| M19 | Country code / intl | WorkspaceCrmSettings | settings | B2 | partial | schema; dial gates pending |
| M20–M30 | Campaign retry/scheduling | campaign-config | campaigns | B3 | not started | see gap doc |
| M31–M39 | Dispositions/cadences/scripts | dispositions, jobs | settings | B4 | not started | |
| M38 | Call ratings + ACW timeout | acw-enforcement, settings | dialer | B1 | done | `afterCallWorkTimeoutSec`, ratings gate |
| M40 | Beep detection auto-drop | beep-auto-drop + AMD | dialer | B1 | done | default OFF; Telnyx machine_end_* |
| M41 | Screening intro copy | screener-intro-playback | settings | B1 | done | truthful TTS/recorded |
| M42 | Abandonment messages | compliance | B8 | not started | counsel |
| M43–M53 | Numbers/reputation | number-health | number-health | B5 | not started | |
| M54–M59 | Compliance/recording | compliance panels | settings | B5 | not started | |
| M60–M68 | Reporting/intelligence | analytics-service | analytics | B6 | not started | |
| M69–M73 | Team/permissions | team-settings | settings | B6 | not started | |
| M74–M75 | AI callback / email | receptionist, email | dialer | B4 | not started | |
| M76 | CRM field sync | crm mappings | integrations | B7 | not started | |
| M77 | HubSpot | — | — | — | **EXCLUDED** | owner |
| M78 | GoHighLevel | — | — | — | **EXCLUDED** | owner |
| M79 | Other new CRMs | — | — | — | **EXCLUDED** | owner |
| M80 | Zapier-compatible API | webhooks API | integrations | B7 | not started | |
| M81 | Customer webhooks | webhook delivery | integrations | B7 | not started | |
| M82 | Public API | API keys | integrations | B7 | not started | |
| M83 | Browser extension | extension | integrations | B7 | not started | |
| M84 | Native mobile apps | — | — | — | **EXCLUDED** | owner |
| M85 | Auto-create inbound contact | contacts runtime | phone | B7 | not started | |
| M86 | Billing dashboard | — | — | — | **EXCLUDED** | owner |
| X01 | AMD initialization | power-dialer-amd, answer-detection | Telnyx webhooks | B1 | in progress | see B1 architecture note |
| X02 | Server orchestration | session-orchestration | sessions API | B1 | in progress | |
| X03 | VM playback lifecycle | vm-drop, webhooks | attempts API | B1 | in progress | |
| X04 | PD recording runtime | power-dialer-recording | settings | B1 | in progress | |
| X05 | Disposition flags | disposition-effects | runtime | B1 | in progress | |
| X06 | Callback automation | callbacks-service | callbacks | B4 | not started | |
| X07 | CSV wizard completeness | csv-import | lists | B2 | not started | |
| X08 | Caller identity / rep numbers | caller-id-resolution | team | B1 | in progress | |
| X09 | Screening settings → runtime | screening-runtime | settings | B1 | in progress | |
| X10 | Honest data only | all surfaces | — | all | not started | ongoing |
| X11 | Bounded resource use | usage-limits, kill switch | settings | B1 | in progress | |
| C01 | CRM Contacts landing | contacts-workspace | `/app/contacts` | B2 | done | DB-backed list (existing) |
| C02 | Contact detail timeline | contact-detail-workspace, native API | `/app/contacts/[id]` | B2 | partial | no mock data; timeline PD + events |
| C03 | Companies | companies routes | contacts subnav | B2 | not started | |
| C04 | Deals / pipeline | deals routes | contacts subnav | B2 | not started | |
| C05 | Tasks & follow-ups | tasks | contacts | B2 | not started | |
| C06 | Calendar / appointments | calendar | contacts | B2 | not started | |
| C07 | Saved views / folders | views | contacts | B2 | not started | |
| C08 | Custom fields admin | field definitions | CRM settings | B2 | not started | |
| C09 | Import/export CRM | csv + export | contacts, lists | B2 | not started | |
| C10 | Unified activity timeline | contact events | contact detail | B2 | not started | |

## B1 architecture — AMD (X01)

**Decision:** Power Dialer keeps the rep on **Telnyx WebRTC** (`client.newCall`) for media. AMD runs on the **linked Call Control leg** for that outbound call: when the browser links `telnyxCallControlId` to `HumanCall`, the server issues Telnyx `answering_machine_detection_start` (premium-capable) on that control ID. Webhooks `call.machine.detection.ended` / `call.machine.premium.detection.ended` feed `applyAmdToPowerDialerAttempt` with expanded result mapping (`human_residence`, `human_business`, `silence`, `fax_detected`, etc.). Future parallel mode (B8) will use **server-originated PSTN callee legs** (`dialPstnLeg` + bridge) with AMD on originate; B1 does not switch the default rep path to server-only originate.

**Rollback (B1+B2 migration):** `20261023190000_power_dialer_b1_b2_native_crm` — drop new tables/columns in reverse order (see migration.sql header); revert application commit.

## Batch commits (feature branch)

| Batch | Commits | Tests |
|-------|---------|-------|
| B1 setup + docs | `67a830031` | — |
| B1 core engine | `85c8498b1` | `test:power-dialer-b1` PASS, `test:power-dialer-phase9` PASS |
| B1 carry-overs + B2 foundation | _(this run)_ | `test:power-dialer-b1-carryovers`, `test:mini-crm-native`, `test:power-dialer-b1`, `test:power-dialer-phase9` |
