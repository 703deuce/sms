/**
 * Regenerates the detailed menu UI inventory appendix from source constants.
 * Run: node scripts/generate-menu-ui-inventory-detail.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/TRANSOVO-MENU-PAGE-UI-INVENTORY-DETAILED.md");
const BASE = join(ROOT, "docs/TRANSOVO-MENU-PAGE-UI-INVENTORY.md");

const recoveryGoals = [
  ["get_reply", "Get a reply"],
  ["request_callback", "Request a callback"],
  ["collect_details", "Collect details"],
  ["book_appointment", "Book an appointment"],
];

const triggerOptions = [
  ["noAnswer", "No answer", "Caller rings but no pickup."],
  ["busy", "Busy", "Line is busy when the call arrives."],
  ["rejected", "Rejected", "Call is actively declined."],
  ["timeout", "Unreachable", "Network or routing timeout before answer."],
  ["voicemail", "Voicemail", "Caller reaches voicemail (when detected on the call path)."],
];

const handoffEvents = [
  "Missed call detected",
  "Customer replied",
  "Lead captured",
  "Callback requested",
  "Urgent situation detected",
  "Human required",
  "Appointment booked",
  "Voicemail received",
  "Recovery failure",
];

const aiRecoveryFields = [
  "Name",
  "What they need",
  "Service location",
  "Urgency",
  "Best time to call back",
];

const setupTabs = [
  "Overview",
  "Phone & Forwarding",
  "Consent",
  "Text Back",
  "Recovery",
  "Voicemail",
  "Notifications",
  "Exclusions",
  "Links",
  "Test",
];

const integrationTabs = [
  "Directory",
  "Calendars",
  "Payments",
  "Connect apps",
  "CRM",
  "API",
  "Webhooks",
  "Developer logs",
];

const callsOutcomeTabs = [
  "All Calls",
  "Leads",
  "Appointments",
  "Messages",
  "Transfers",
  "Voicemails",
  "No Answer",
];

const callsTopTabs = ["All calls", "Needs attention"];

const missedRecoveryFilters = [
  "All recovery outcomes",
  "Needs attention",
  "Replied",
  "Waiting for consent",
  "Suppressed",
  "Failed",
];

let base = readFileSync(BASE, "utf8");
base = base.replace(
  "**Generated:** 2026-09-26 (code audit of production routes/components)",
  "**Generated:** 2026-09-26 · **Detail pass:** exhaustive UI box/feature list (see sections below)",
);

const supplement = `

---

# DETAILED SUPPLEMENT (every box / control)

## 1. Voice Overview — field-level

| Block | Fields / controls |
|-------|-------------------|
| PageHeader | Title · Description |
| First-run card | Heading · body · **Start setup** button → \`/mctb/voice-agent\` |
| Status card | Publication pill · Name · Voice label · Published note · **Manage receptionist** link |
| Status rows | Phone · Calendar · Business knowledge · Business hours (label + value + warn tone) |
| Needs attention | Per row: label · **Review →** link |
| Metrics | Period label · **View analytics →** · StatCard: Calls · Appointments booked · Callbacks requested |
| Recent calls table | Columns: Caller (link) · Time · Duration · Outcome badge · Attention badge · chevron |
| Dependencies | Per DependencyRow: label · status · fix link (when API returns) |

---

## 2–3. Voice Calls & Receptionist — field-level

**Calls:** H1 · subtitle · CallsMetrics (4 metrics + deltas) · search · period select · tabs (see below) · filter tabs · table · pagination · NeedsAttentionView when tab 2

**Receptionist hub:** H1 · Continue setup · Open setup editor · DL: Publish status · Receptionist name · Greeting · Capabilities

---

## 4. Business Knowledge — sections & typical fields

1. **Needs your review** — gap list with review actions  
2. **Core business information** — business name · description · industry · services list · service area  
3. **Business hours & timezone** — weekly hours editor · timezone select  
4. **Website** — URL · crawl/import · last synced  
5. **FAQs & approved answers** — Q/A pairs · add/edit/remove  
6. **Knowledge sources** — upload documents · website source · source status · delete  

Anchor: \`#knowledge-gaps\` for unanswered questions panel

---

## 5. Call Handling — sections & controls

1. **Current behavior** — effective handler (human vs AI) · phone line summary  
2. **Transfers** — transfer targets · waterfall order · test transfer  
3. **Business hours & after hours** — schedule · after-hours routing behavior  
4. **On-call** — on-call recipients · schedule  
5. **Emergency & urgent calls** — urgent keywords/rules · routing  
6. **Transfer notifications** — who gets notified on transfer  
7. **Caller protection** — spam/solicitor blocking · blocked callers manage dialog  
8. **Call recording** — enable/disable · retention notice  
9. **Recent transfers** — table of transfer attempts  

**Also shows:** “Can Amy transfer calls right now?” effective status card when applicable

---

Use this section when you need field-level and tab-level completeness. Component paths are under \`src/\`.

## Global: MCTB Setup horizontal tabs (on every \`/mctb/setup/*\` page except wizard)

${setupTabs.map((t, i) => `${i + 1}. ${t}`).join("\n")}

**Shared setup chrome on section pages:** Page title + description · **Save changes** (where applicable) · Saved indicator · Error banner · Section tab bar above.

---

## 7. MCTB Overview — every block (expanded)

| # | UI block | Contents |
|---|----------|----------|
| 1 | Header | Title "Overview" · Status chip · Subtitle · CTA button (Finish setup / Resume / Fix messaging / Manage setup) |
| 2 | Setup incomplete banner | Warning text · Continue setup link |
| 3 | Call Handling card | (non-compact) Mode + forwarding summary · link to call handling |
| 4 | KPI strip (4 tiles) | Missed calls · Recovery texts sent · Customer replies · Needs reply (each: value, "Today" sublabel, links) |
| 5 | AI Recovery | Enabled/disabled · policy count · Manage link OR one-line compact |
| 6 | Needs attention | List: title, subtitle, chevron per item OR "Nothing needs attention" strip |
| 7 | Recent missed calls | Table: Caller, Missed, Recovery, Reply · View all · empty state |
| 8 | Recent conversations | List: label, preview, time, Needs reply badge · Open inbox |
| 9 | Recent activity | Timeline items with title, subtitle, time · View analytics · empty/first-use states |
| 10 | Setup status | Rows: Business line · Forwarding · Consent · Text-back sender · Recovery · Call recovery · View analytics |

---

## 8. Missed Calls — every control (expanded)

**Header:** Title · description · Manage setup link

**Summary strip (4):** Missed calls · Recovery texts · Replies · Needs reply (last links to inbox \`filter=needs_reply\`)

**Toolbar:** Search · Recovery outcome select (${missedRecoveryFilters.join(" · ")}) · Date (Today / 7d / 30d / All) · Trigger (All / No answer / Busy / Rejected / Unreachable / Voicemail) · Sort · Filters popover · Clear filters

**Mobile:** Filters sheet (same fields) · Done

**Table columns:** Caller (name, phone, repeat badge) · Missed time · Trigger · Recovery (status + suppression reason) · Reply · Business line · Actions

**Per-row actions:** Callback (tel link) · Menu: Open details · Open conversation · Copy number

**Pagination:** Page size · prev/next

**Mobile list:** Card per row with same data condensed

---

## 9. Inbox — every region (expanded)

**Product filter bar:** Filter conversations by product (MCTB on this route)

**List sidebar buckets (URL-driven):** All · Mine (unread/open/pending counts) · Unassigned · Closed · Snoozed · Spam · Per-tag filters · Per-teammate filters

**List header:** Search · Select all checkbox · Bulk actions when selected

**Thread:** Message bubbles (inbound/outbound) · compliance vs recovery styling · delivery states · system events (opt-out)

**Composer:** Text area · Send · blocked states (opt-out, sender, read-only)

**Context panel (when open):** Contact · missed-call link

**URL:** \`conversation=\` · \`filter=needs_reply\` · \`product=mctb\`

---

## 10. AI Recovery — every field (expanded)

**Header:** Save changes · Saved · errors

**Section: AI Recovery:** Description · master enable switch · sender line · Inbox/Missed Calls links

**Section: Business information:** Name · services · service area · hours · Edit business information link

**Section: Information to collect** (checkboxes):
${aiRecoveryFields.map((f) => `- ${f}`).join("\n")}

**Section: Booking link** (if available): Enable toggle · select existing link · URL input · label

---

## 12. MCTB Analytics — every metric row (expanded)

**Range:** 7d · 30d · 90d

**KPIs:** Missed calls · Recovery texts sent · Customers replied · Reply rate

**Funnel steps:** Missed calls · Eligible (% of missed) · Recovery texts sent (% of eligible) · Customer replies (% of texts)

**Charts:** Missed over time · Recovery texts over time · Replies over time

**Outcomes & delivery DL:** Delivery failures · Booking links sent · Callback requests · AI-assisted conversations · Tracking link clicks · Opt-outs (suppressed)

**Definitions DL:** Eligible · Recovery texts sent · Customer replies · Reply rate

**Suppression table:** Reason · Count · % (drilldown links)

**Voicemail panel:** Count · Open voicemail link

---

## 13b. Phone & Forwarding — every module (expanded)

**Status strip:** Business line · Forwarding to · Carrier · Connection state

**Module: Business line:** Phone input · Verified / Not verified chip · helper text

**Module: Forwarding destination:** Assigned ingress number · Voice ready chip · Change destination control

**Module: Carrier:** Grid of carrier options (canonical carrier guides)

**Module: Forwarding setup:** Walk me through · Show instructions buttons · opens drawer with step list

**Module: Ring before forwarding:** Preset segments (with Recommended) · Custom seconds input · warning if too low

**Module: Verification:** I've turned it on · verification checklist · evidence status

**Sidebar rail (when present):** Sender summary · troubleshooting links · Save changes

---

## 13c. Consent — every module (expanded)

**Status strip:** Status · Method · Text-back sender · Evidence

**Module: Consent method** (radio cards): Ask callers to press 1 · Use permission my business already has

**Module: Caller experience:** Step flow diagram (call → disclosure → press 1 → texts)

**Press-1 only:** Disclosure preview · Preview disclosure audio · If caller does not press 1 explanation

**Module: Evidence:** Method · Captured · Stored with (Press-1) OR Method · Basis · Attested (existing)

**Right rail:** Consent summary · Best for · Current call flow · Related settings links

**Modals:** Switch to existing consent (attestation checkbox) · Switch to Press-1 confirmation

---

## 13d. Text Back — every control (expanded)

**Paused banner** (when recovery paused)

**Consent method card:** Read-only method · Change consent method link

**Recovery goal cards:**
${recoveryGoals.map(([, t]) => `- ${t}`).join("\n")}

**Recovery opener preview** box · sender presentation note · locked message notice (platform sender)

**Advanced:** Customize opener textarea (toggle)

**Delivery timing:** Delay before sending (seconds) · link to Links & request form

**Save:** via section layout header

---

## 13e. Recovery — every module (expanded)

**Status module:** Recovery active/paused · Resume · Pause (opens pause modal)

**Triggers** (toggle buttons):
${triggerOptions.map(([, l, h]) => `- **${l}** — ${h}`).join("\n")}

**Repeat callers:** Cooldown Off · 15m · 30m · 1h · 4h · Custom minutes · illustrative mini-flow

**AI Recovery** promo card → link to /mctb/ai-recovery

**Booking section** (when not hidden): appointment booking config

**Recovery guardrails:** Recovery delay (modal) · Repeat caller behavior row · Max automated messages (when shown)

**Right rail:** Recovery summary · How recovery works · Recent suppressions list

**Modal: Pause recovery** — presets · custom date/time · indefinite · Resume now

**Modal: Recovery delay** — seconds/minutes input

---

## 13f–13j. Other setup sections (summary of boxes)

**Voicemail setup:** Greeting type · record/upload/TTS · preview · activate · transcription toggle · post-voicemail text behavior

**Notifications:** Status strip (Alerts · Primary email · SMS alerts · AI replies) · AI replies mode · Information to collect matrix (per-field Off/Optional/Required) · Emergency handling · Team recipients (add/edit/delete, per-recipient email events) · Notification events table (Event × Email × SMS × In-app) for:
${handoffEvents.map((e) => `- ${e}`).join("\n")}
· Quiet hours (enable · start/end · emergency bypass · delay SMS) · Test notifications · Right rail summary panels

**Exclusions:** Status strip (Total · Added here · Personal · Recently added) · Search · filters (Reason · Source · Record type · Sort) · Table (Caller · Phone · Reason · Source · Added · Actions: copy, remove) · Add exclusion modal · Remove modal · How exclusions work

**Links:** Default link URL · Request form presets (goal buttons) · Enable public request form · Lead capture · Form fields list · Copy/Preview public URL · Resolved {{link}} preview

**Test:** Production path callout · Setup test (Start/Run again · timeline checkpoints: Call reached MCTB · Workspace · Consent mode · Greeting · Press 1 if applicable · Consent recorded · Missed call event · SMS queued · Provider accepted) · Live forward test callout · Live test timeline (Call detected · Missed · Consent · Text sent · Delivered · Reply in inbox) · After testing links

**Setup overview extras:** Pause control on status rail · Health strip · Attention rows · Flow strip stages · Call flow summary rows (5) · Operations rows (Notifications · Exclusions · Links · Test) · Activity timeline · Quick actions: Run live test · Forwarding instructions · Edit recovery message · Change consent · Change voicemail greeting

---

## 2. Calls — tabs (explicit)

**Top tabs:** ${callsTopTabs.join(" | ")}

**Outcome tabs (All calls):** ${callsOutcomeTabs.join(" | ")}

**CallsMetrics:** Answered · Leads · Appointments · Talk time (+ trend %)

**Period:** Today · 7d · 30d

---

## 6. Voice Analytics — KPI list (explicit)

Calls · Appointments booked · Transfers answered · Callbacks requested · Avg. duration · Voicemail

**Sections:** Call volume chart · Call outcomes list · Receptionist performance (3 cards) · Caller sentiment (4, if enough data) · Usage (AI minutes · Phone minutes) · Advanced (p95 latency)

---

## 14. Integrations — tabs (explicit)

${integrationTabs.map((t, i) => `${i + 1}. ${t}`).join("\n")}

**Home blocks:** Platform integration cards (calendar/Stripe focus) · Connect your apps grid · Integrations directory (API/webhooks status)

---

## 16. Billing — every card (expanded)

**H1:** Billing · description

**Settings tabs on page:** (product-aware — see \`getSettingsTabs()\` or appointments subset)

**BillingStatCards:** plan/credits summary metrics

**CreditPurchaseCard:** buy credits · payment method

**EstimateCard:** itemized estimate

**UsageTable:** usage rows by product/metric

**LedgerCard:** credit ledger entries

**InvoicesCard:** invoice list / links

---

## 17. Settings / Business — every card (expanded)

**H1:** Business settings · Save changes

**Settings tabs (MCTB legacy shell):** Business · Integrations · Messaging · Email-to-SMS · Users · Workspaces · Notifications · Billing · Payments · Limits · Security · Branding · Data

**Cards:** Booking enabled toggle · Business profile (name, email, phone, address, website, timezone) · Public legal (terms, privacy, SMS consent text/version) · Suspicious bookings table · Messaging registration (brand/campaign status)

---

## Missed call detail — every panel field

**Chrome:** Back link · H1 caller · badge · primary action (Open conversation / Call customer)

**Lifecycle OL:** Call · Consent · Compliance text · Recovery text · Reply (values per mode)

**Call details DL:** Caller · Business line · Missed · Trigger · Repeat calls

**Consent DL:** Method · Outcome · timestamps · View consent record link

**Text-back:** Compliance message state · Recovery message state · content previews

**Voicemail:** link/audio summary when present

**Conversation:** thread preview · Open conversation

**Link activity / Request form:** when data exists

**Diagnostics:** collapsed technical IDs

`;

writeFileSync(OUT, base + supplement, "utf8");
console.log("Wrote", OUT, "bytes:", readFileSync(OUT).length);
