# Power dialer competitor teardown: Kixie, PhoneBurner, JustCall vs Transovo

Generated 2026-10-22 (America/New_York). Full text version of the Page at https://cursor.com/canvas/store-bfe21f4a-f399-4d8d-af53-a13de82180ab/66ba5e19-474f-48a9-99a4-424dabeebb6e

What the three leading power dialers document in their help centers, how that compares with Transovo's current power dialer, and a launch-ordered build list with a proposed menu.

## Read this first

Transovo has the dial button, lists, sessions, and dispositions. What the competitors sell is the rules engine around them: attempt caps, retry timing, calling hours, DNC, callbacks, disposition-driven actions, voicemail drop with machine detection, and local caller ID pools. Of 51 features compared, Transovo has 3, partly has 11, lacks 31, and 6 could not be verified from the inventory.

## Contents

1. Which three and why
2. How this was researched
3. What the three agree on
4. UI and help-doc map by product (Kixie, PhoneBurner, JustCall)
5. Feature matrix against Transovo (vendor comparison and Transovo gap)
6. Telnyx and Twilio requirements
7. Compliance items
8. Prioritized build list
9. Proposed Power Dialer menu
10. Gaps and unverified items
Appendix A. Transovo power dialer inventory used
Appendix B. Dialer-relevant help-center article index (all three vendors)
Appendix C. Sources

## 1. Which three and why

| Product | Why it is here | Chosen |
| --- | --- | --- |
| Kixie | Confirmed by John. G2 866 reviews, 4.8 (third-party and vendor-authored sources). Multi-line, local presence, deepest list-rules engine. | Yes |
| PhoneBurner | Dedicated power dialer. G2 292 reviews, 4.7. Single-line by design, published pricing, strongest on deliverability and dispositions. | Yes |
| JustCall (Sales Dialer) | Most G2 reviews of the group (2,382, 4.3, Aug 2026) and the best-documented dialer help center (84 articles). Power, Dynamic, Predictive modes. Broader phone system than a pure dialer. | Yes |
| Close, CloudTalk, Aircall, Mojo, Orum | Considered, not examined. Close is a CRM, Aircall and CloudTalk are phone systems, Mojo is real estate focused, Orum is enterprise parallel dialing. No docs reviewed. | No |

| Product | Price as found | Source |
| --- | --- | --- |
| Kixie | No prices on kixie.com/pricing (Professional, Single-Line PowerDialer, Multi-Line PowerDialer). Third-party estimates range from $35 to $145 per user per month; Kixie's help article lists a DNC add-on at $20 per user per month. | https://www.kixie.com/pricing |
| PhoneBurner | Standard $140 and Premium $183 per user per month billed annually; Standard $165 monthly (pricing page). Professional is $165 annual per Kixie's comparison blog. Unlimited calling on every tier. | https://www.phoneburner.com/pricing |
| JustCall | Pro $49 per user per month annual or $69 monthly, two-seat minimum, Power Dialer only. Predictive and Dynamic need quote-based SalesPro. Prices come from Kixie's comparison blog (competitor-authored). | https://www.kixie.com/sales-blog/best-affordable-power-dialers/ |

## 2. How this was researched

- **Kixie:** Help center via its public Zendesk Help Center API: 255 articles indexed, about 40 read in full. Product and pricing pages fetched.
- **PhoneBurner:** Help center via its public Zendesk Help Center API: 497 articles indexed, about 45 read in full (Salesforce, Zoho, HubSpot, and most contact-manager articles indexed by title only). Features and pricing pages fetched.
- **JustCall:** Sales Dialer help collection: 84 articles listed, about 30 read in full, plus the auto-dialer product page.
- **Not done:** No product was signed into and no screenshots were seen. Navigation labels come from help-article instructions. G2 and Capterra pages were blocked or empty, so review counts come from third-party and competitor-authored comparisons.
- **Bias to note:** Kixie's comparison blog is written by Kixie. Its JustCall and PhoneBurner figures are used only where marked.

## 3. What the three agree on

- The list is the product. Kixie's PowerList and JustCall's campaign carry the attempt caps, retry delay, calling hours, priority, and disposition rules. PhoneBurner keeps lists in a contact manager and puts rules on dispositions.
- Dispositions drive automation: remove from list, move to another list, schedule a callback, send an SMS, mark DNC, fire a webhook.
- Number reputation is its own product: ConnectionBoost, ARMOR, and Number Health. Local presence is table stakes.
- Single-line power dialing is the safe core. PhoneBurner stays single-line on purpose; Kixie and JustCall add multi-line with machine detection and abandonment handling.
- None of the three ships a free national DNC scrub. Kixie sells a probabilistic add-on, PhoneBurner integrates DNC.com, JustCall leaves it to the buyer.
- Voicemail drop is universal, and the better ones wait for the beep.

## 4. UI and help-doc map by product

Columns: screen or area, what the documentation shows, help doc URL(s).

### 4a. Kixie (support.kixie.com)

| Screen or area | What the documentation shows | Help doc URL |
| --- | --- | --- |
| Access levels | Agents (User permission) see only My Profile. Managers also get Manage, Reporting, and History (full call and SMS log with CSV export). | https://support.kixie.com/hc/en-us/articles/4404608409755 |
| Manage > Agents | Add or edit agents. A User Products tab assigns the PowerDialer tier (help article lists 1, 4, or 10 lines, or AI Human Detect), plus Conversation Intelligence, ConnectionBoost, and DNC add-ons. | https://support.kixie.com/hc/en-us/articles/4565589331483  https://support.kixie.com/hc/en-us/articles/22656918351259 |
| Manage > Teams | Teams group agents. Teams are required for PowerLists, Call Queues, and Team SMS. | https://support.kixie.com/hc/en-us/articles/360041587874 |
| Manage > PowerLists (campaign list) | Table of PowerLists with a Priority column. Actions menu has Clone and View Contacts. Button: + New Team PowerList. Agents have My Profile > My PowerLists for personal lists (manager can disable). | https://support.kixie.com/hc/en-us/articles/4565589331483 |
| PowerList settings | Priority (Highest to Lowest), Dial at a Time, Target Hours and PowerList Hours (contact's timezone derived from area code), Min Duration Before Retry, Daily Max Attempts (default 2), Total Max Attempts (default 10), Next PowerList, Seconds Before Timeout (default 30), Require Call Outcome (default ON), Prevent Deselection, CRM Ownership Rules, Members (teams). | https://support.kixie.com/hc/en-us/articles/4565589331483 |
| PowerList contacts | Spreadsheet upload with a visual column-mapping tool, or import a static HubSpot list. Invalid numbers are removed on upload. Only phone is required. Standard fields: email, first, last, title, company, PowerList Notes (Next Call Refresher). Six custom fields. URLs become clickable. | https://support.kixie.com/hc/en-us/articles/4565589331483 |
| PowerList > View Contacts | Summary counts: Total, Queued, In Progress, Deferred, Removed. Stats: Dialed, Answered, Connected. Contacts table with per-number remove. | https://support.kixie.com/hc/en-us/articles/18570135631515 |
| Priority and Next PowerList | Waterfall: contacts move to a lower-priority list after max attempts. Standby Mode dials newly added hot leads immediately. If Owned, Dial by Owner keeps CRM-owned leads with their owner. | https://support.kixie.com/hc/en-us/articles/20404809914523  https://support.kixie.com/hc/en-us/articles/20406923205275 |
| Manage > Call Outcomes | Each disposition has a name, display order, and a destination: None, a Cadence, or a PowerList. PowerList outcome rules can remove the number, forward it to another PowerList, or assign the CRM owner. Multiple rules can fire per outcome. | https://support.kixie.com/hc/en-us/articles/4582727772955  https://support.kixie.com/hc/en-us/articles/360013241573 |
| Manage > Cadences | Sequences of calls and SMS fired by a trigger. Needs a Team and a Queue first. Owner auto-assigned round robin or on answer. | https://support.kixie.com/hc/en-us/articles/1260803683709 |
| Manage > Inbound | IVRs, Ring Groups, Call Queues, CRM rules-based routing (inbound side, not dialer). | https://support.kixie.com/hc/en-us/articles/4402428065435  https://support.kixie.com/hc/en-us/articles/360047302494  https://support.kixie.com/hc/en-us/articles/17326350115227 |
| Manage > Account Settings | Tabs: Settings (hold music, timezone), Options (record calls, create CRM contacts, connection duration, show or require outcome, AI Human Detect timeout 2 to 5 s), Manager Options (restrict reporting and numbers, allow agent PowerLists, allow webhooks), Integrations (API key, Business ID), Connected CRMs, Business Hours, Harassment Rules (default 3 calls and 2 SMS per day, applies to auto-calls, not PowerDialer), Custom CRM. | https://support.kixie.com/hc/en-us/articles/4405882549531 |
| Reporting | Agent Reports (line chart by team, metric, daily/weekly/monthly), Agent Status (workforce: logged in, idle, DND, handle time, after-call work), Agent Summary (includes PowerList dial attempts), Business Snapshot, Agent Snapshot, Inbound Summary, Queues > Live. | https://support.kixie.com/hc/en-us/articles/115004810148  https://support.kixie.com/hc/en-us/articles/17499874438683  https://support.kixie.com/hc/en-us/articles/18085747066651  https://support.kixie.com/hc/en-us/articles/17465386328091 |
| Activity History > Call History | Account-wide log. Source column: Manual Dial, PowerDialer, Click-to-call, Cadence, API. Source Link shows the PowerList. Disposition, duration, amount, recording link, CRM link, CSV export. | https://support.kixie.com/hc/en-us/articles/19077710635163 |
| Live Call Board and Leaderboards | Real-time agent status (blue idle, orange offline, green on call, red DND) filterable by Team, PowerList, Queue. Live leaderboards. | https://support.kixie.com/hc/en-us/articles/21041171199387  https://support.kixie.com/hc/en-us/articles/13010009538203 |
| My Profile > Agent Settings | My PowerLists, VM Drop library, Inbound Call Flow, SMS Templates. | https://support.kixie.com/hc/en-us/articles/4576581944731  https://support.kixie.com/hc/en-us/articles/360013080574 |
| Dialer window: Overview tab | Queued, Deferred, Dialed, Answered, Connected, Talk Time, Machines Detected (current session). | https://support.kixie.com/hc/en-us/articles/4582890954907 |
| Dialer window: Session tab | Tick PowerLists, Start Dialing, pause, resume, end. Reserved Contacts (next numbers). Need Outcome status blocks dialing until a disposition is saved. AI Human Detect toggle beside Start Dialing. | https://support.kixie.com/hc/en-us/articles/4582890954907  https://support.kixie.com/hc/en-us/articles/24665570825755 |
| Dialer window: Outcome tab | Contact card (name, title, company, email), editable PowerList Notes, CRM Notes, Do Not Call Sooner Than date, Call Outcome dropdown, SMS Template, Contact Management Action. | https://support.kixie.com/hc/en-us/articles/4582890954907 |
| Contact Management Actions | Per-contact number groups. Always Use This Number, Remove This Number, Remove This Contact. | https://support.kixie.com/hc/en-us/articles/27053556553115 |
| Voicemail Drop | Upload MP3 (5 MB) or record in browser. AI Smart Beep Detection waits for the beep, then plays. One click from the call bar. | https://support.kixie.com/hc/en-us/articles/4576581944731 |
| Local presence and ConnectionBoost | Standard local presence uses numbers you own. ConnectionBoost rotates through a nationwide pool of 50,000+ local numbers, suppresses low performers, and routes callbacks to the last agent. Toggle in the dialer. | https://support.kixie.com/hc/en-us/articles/4585141066779  https://support.kixie.com/hc/en-us/articles/360057490914 |
| Number reputation | Number Health Reputation Manager, registration with Hiya and First Orion, spam-label remediation, number warm-up guidance, business identity registration. | https://support.kixie.com/hc/en-us/articles/34120536779803  https://support.kixie.com/hc/en-us/articles/39314424566427  https://support.kixie.com/hc/en-us/articles/360057501594  https://support.kixie.com/hc/en-us/articles/39479985832859  https://support.kixie.com/hc/en-us/articles/55431133322779 |
| Recording and consent | Outbound recording All, None, or Two-Party (auto-disables recording in two-party-consent states by area code). Allow Pause Recording. | https://support.kixie.com/hc/en-us/articles/360009448814  https://support.kixie.com/hc/en-us/articles/4404258992923  https://support.kixie.com/hc/en-us/articles/30128591092763 |
| Do Not Call | DNC Algorithm add-on ($20 per user per month per the article) blocks or warns on numbers it detects as likely on the registry. PowerList DNC Consent toggle overrides for consented lists. Legal disclaimer published. | https://support.kixie.com/hc/en-us/articles/16376376568859  https://support.kixie.com/hc/en-us/articles/16403691600155 |
| Coaching and transfer | Directory in the dialer lists agents by status. Listen, whisper, barge on live calls. Transfer and 3-way conference. | https://support.kixie.com/hc/en-us/articles/4426421020187  https://support.kixie.com/hc/en-us/articles/4583510976027 |
| Conversation Intelligence and AI Dashboard | Per-agent add-on: transcripts, sentiment, keywords, call strength score. Separate AI Dashboard (ai.kixie.com): ready-made dashboards, report builder, call scoring and Playbooks, AI agents. | https://support.kixie.com/hc/en-us/articles/17657473883419  https://support.kixie.com/hc/en-us/articles/55213444516507  https://support.kixie.com/hc/en-us/articles/56521749445787  https://support.kixie.com/hc/en-us/articles/56521801751963 |
| SMS | SMS and MMS, templates, Team SMS, 10DLC registration and opt-out handling. | https://support.kixie.com/hc/en-us/articles/4582396778395  https://support.kixie.com/hc/en-us/articles/16188947660571  https://support.kixie.com/hc/en-us/articles/56952261413275  https://support.kixie.com/hc/en-us/articles/10453600065051 |
| API and webhooks | PowerList API (add, remove, remove from all; 10,000 calls per day default). Make a Call, Send to Queue, Agent Status APIs. Webhooks: Start Call, Voicemail, Call Outcome, Schedule Activity. | https://support.kixie.com/hc/en-us/articles/19135310564635  https://support.kixie.com/hc/en-us/articles/7273987300635  https://support.kixie.com/hc/en-us/articles/18238735604379  https://support.kixie.com/hc/en-us/articles/18238875912347 |
| CRM integrations | Native: HubSpot (22 articles), Pipedrive (8), Zoho (7), Salesforce (7), HighLevel (4), Outreach, Vendasta, plus several smaller CRMs and Zapier. Calls, outcomes, notes, recordings log back automatically. | https://support.kixie.com/hc/en-us/articles/115009775068 |
| Chrome extension and hotkeys | PowerCall runs as a Chrome extension. Hotkeys: open, answer, initiate call, end call. | https://support.kixie.com/hc/en-us/articles/360019966513  https://support.kixie.com/hc/en-us/articles/4685749871131 |
| Changelog | Feb 2025 release added PowerList cloning, improved voice detection, Connected CRMs panel, My Agent Summary. | https://support.kixie.com/hc/en-us/articles/34015932071323 |

### 4b. PhoneBurner (support.phoneburner.com)

| Screen or area | What the documentation shows | Help doc URL |
| --- | --- | --- |
| Top-level navigation (inferred from instructions, not seen on screen) | Contacts (Contact Manager); Call History (Recent Dial Sessions plus Dial Session Settings); Appointments calendar; Team > Reports for admins; initials menu at upper right opens Settings, My Account, Integrations, Inbound, Numbers, SMS, Contact Settings, LeadStream. | https://support.phoneburner.com/hc/en-us/articles/115004996246  https://support.phoneburner.com/hc/en-us/articles/6528816426004  https://support.phoneburner.com/hc/en-us/articles/360022215451 |
| Contact Manager | Folders and sub-folders, pinned Quick Views, saved and shared searches, advanced search, layouts, tags, custom fields, bulk edit, merge duplicates, per-contact local time, DNC flags. | https://support.phoneburner.com/hc/en-us/articles/36411068536980  https://support.phoneburner.com/hc/en-us/articles/360000344403  https://support.phoneburner.com/hc/en-us/articles/360001203883 |
| Import | CSV import with field mapping, duplicate screening, invalid number finder, export of contacts and dial sessions. | https://support.phoneburner.com/hc/en-us/articles/360019870812  https://support.phoneburner.com/hc/en-us/articles/37097345280532  https://support.phoneburner.com/hc/en-us/articles/360000187906  https://support.phoneburner.com/hc/en-us/articles/360000344383 |
| Begin Dial Session pop-up | Pick phone script, voicemail, dialing set, live answer set, caller ID (number pool), dialer mode (Power Dialing or Pause and Preview), call recording, and connection method (browser softphone, dial-in by phone, ConnectMe). | https://support.phoneburner.com/hc/en-us/articles/36410902719252  https://support.phoneburner.com/hc/en-us/articles/115004996246 |
| Dial session window | Disposition buttons run along the bottom. Dialing set for no-answer outcomes; live answer set (button turns green when a person answers). One-click recorded voicemail, live voicemail, notes, follow-up date, appointments, SMS, one-touch email, hold, warm transfer, Mute (2026). | https://support.phoneburner.com/hc/en-us/articles/360000483603  https://support.phoneburner.com/hc/en-us/articles/360047583871  https://support.phoneburner.com/hc/en-us/articles/51757177595156 |
| Dialer Presets and Pause and Preview | Save session settings as presets. Preview mode lets the rep review notes, send SMS, or skip before dialing. | https://support.phoneburner.com/hc/en-us/articles/360043378732  https://support.phoneburner.com/hc/en-us/articles/360049313692 |
| Dial Session Settings > Dispositions | Dialing Set and Live Answer Set, each with custom buttons. Per button: voicemail to play, one-touch email, next action (ask, next number, next contact), DNC number or entire contact, move to folder, tag, SMS, webhook, require follow-up date. | https://support.phoneburner.com/hc/en-us/articles/115005890643  https://support.phoneburner.com/hc/en-us/articles/36411241058068 |
| Dial Session Settings > Phone Scripts | Scripts with merge codes (contact and sender fields, custom fields). Edit, duplicate, preview. Team admins can push system scripts. | https://support.phoneburner.com/hc/en-us/articles/36826876856468 |
| Dial Session Settings > Voicemail Library | Record by dialing in, or upload MP3. Voicemail disposition appears only after one is recorded. Library sortable. | https://support.phoneburner.com/hc/en-us/articles/115005284946  https://support.phoneburner.com/hc/en-us/articles/36411165416084 |
| Dial Session Settings > General | Ring duration (25 s suggested for live answers, 40+ s to reach voicemail), ring sound, remove duplicate numbers in a session, skip duplicates within a contact, automatic email delivery, timestamp style. | https://support.phoneburner.com/hc/en-us/articles/360001155226  https://support.phoneburner.com/hc/en-us/articles/115005867966  https://support.phoneburner.com/hc/en-us/articles/115005075006 |
| Dial Session Settings > Calling Times | Default 8 am to 9 pm per FTC guidance. Time zone comes from the phone number's area code, not the address. Toll-free numbers are not blocked. Summer 2026 added per-day hours, 15-minute increments, and lunch windows. | https://support.phoneburner.com/hc/en-us/articles/360015673251  https://support.phoneburner.com/hc/en-us/articles/360028713831  https://support.phoneburner.com/hc/en-us/articles/115005668723  https://support.phoneburner.com/hc/en-us/articles/51757177595156 |
| Dial Session Settings > Limit Area Codes | Allow-list or block-list US area codes. | https://support.phoneburner.com/hc/en-us/articles/115005755846 |
| Dial Session Settings > DNC | Account or team DNC list. Entries from dispositions, contact record, manual paste, or an SMS STOP reply. Dialer skips them. Separate DNC.com real-time scrub integration (own subscription). | https://support.phoneburner.com/hc/en-us/articles/115005070583  https://support.phoneburner.com/hc/en-us/articles/360000255703  https://support.phoneburner.com/hc/en-us/articles/37413898203540 |
| Dial Session Settings > Call Recording and Transcription | Admin or solo toggle; only calls dispositioned as live answers are recorded. Premium AI note taker adds transcript, summary, talk ratio. | https://support.phoneburner.com/hc/en-us/articles/115005941146  https://support.phoneburner.com/hc/en-us/articles/360016580591  https://support.phoneburner.com/hc/en-us/articles/28212233001492 |
| Dial Session Settings > Call Transfer | Transfer agents (names, numbers, notification emails), warm transfer, recording behavior during transfer. | https://support.phoneburner.com/hc/en-us/articles/36826426640532  https://support.phoneburner.com/hc/en-us/articles/360018741912 |
| Resume and call attempts | Unfinished sessions can be resumed from Recent Dial Sessions for 60 days. Reset Call Attempts (single or bulk, permissioned) added in 2026. | https://support.phoneburner.com/hc/en-us/articles/360000516743  https://support.phoneburner.com/hc/en-us/articles/51757177595156 |
| Numbers: pools, local presence, caller ID | Number Pools with routing strategies (myself, team member, best member, call flow, call group, external). Random or Local Presence rotation (needs Trust and Safety approval). Caller ID consistency per contact. BYO caller ID, CNAM, branded caller ID, verified caller ID library. | https://support.phoneburner.com/hc/en-us/articles/11303474714772  https://support.phoneburner.com/hc/en-us/articles/35518183347348  https://support.phoneburner.com/hc/en-us/articles/16316515469716  https://support.phoneburner.com/hc/en-us/articles/35521456256148  https://support.phoneburner.com/hc/en-us/articles/36151978041620  https://support.phoneburner.com/hc/en-us/articles/29113192674068 |
| ARMOR and Connect Score (add-ons) | ARMOR dashboard: number monitoring, flagged numbers, call volume, remediation. Connect Score rates how likely a number is to connect; dialer can skip low scores. | https://support.phoneburner.com/hc/en-us/articles/35517478601364  https://support.phoneburner.com/hc/en-us/articles/37415132398356  https://support.phoneburner.com/hc/en-us/articles/40746440876436 |
| Inbound | Premium: accept inbound calls inside an outbound session. Call flows, call groups, inbound history and voicemail. | https://support.phoneburner.com/hc/en-us/articles/35517191861268  https://support.phoneburner.com/hc/en-us/articles/31263283262484  https://support.phoneburner.com/hc/en-us/articles/37030906845972 |
| Email and SMS | One-touch emails tied to dispositions. SMS from templates tied to dispositions or typed in session (Premium, A2P 10DLC approval, $50 one-time application fee). | https://support.phoneburner.com/hc/en-us/articles/4418739233044  https://support.phoneburner.com/hc/en-us/articles/4418731887508  https://support.phoneburner.com/hc/en-us/articles/37916865941908  https://support.phoneburner.com/hc/en-us/articles/115005672246 |
| Appointments | Calendar tab; schedule from dial session (Actions > Schedule Appointment) or contact record. Google Calendar sync. | https://support.phoneburner.com/hc/en-us/articles/360022215451  https://support.phoneburner.com/hc/en-us/articles/115005897043 |
| Reports (Team > Reports) | Standard: Dial Sessions, Disposition Summary, Connection Rate, Leads by Source, SMS Usage. Custom: Team Summary, Member Detail, Activity, Funnel, Source, Real-Time Leaderboard. Email delivery on a schedule. CSV or ZIP with recordings. | https://support.phoneburner.com/hc/en-us/articles/6528816426004  https://support.phoneburner.com/hc/en-us/articles/41058813529492  https://support.phoneburner.com/hc/en-us/articles/41058364550036  https://support.phoneburner.com/hc/en-us/articles/41059038898580  https://support.phoneburner.com/hc/en-us/articles/41060676841492 |
| Team admin: live calls, supervisors | Default admin page shows live calls. Supervisor role with groups and per-permission access (live dashboard, login-as, reports, contact search). | https://support.phoneburner.com/hc/en-us/articles/360059805911  https://support.phoneburner.com/hc/en-us/articles/39766295689748 |
| LeadStream | Lead distribution: Blind or Preview Pull, Round Robin, Lead Blitz (first to claim), receiving, distribution, and recycle folders, distribution reports. | https://support.phoneburner.com/hc/en-us/articles/39564738547988  https://support.phoneburner.com/hc/en-us/articles/115005515126 |
| Integrations, API, webhooks | Salesforce (85 articles), HubSpot, Zoho, GoHighLevel, Nimble, Outreach, Zapier. Personal access token API. Webhooks: call begin, call end, call end by disposition, contact displayed, contact activity, manual. | https://support.phoneburner.com/hc/en-us/articles/36826752283028  https://support.phoneburner.com/hc/en-us/articles/39011166673556  https://support.phoneburner.com/hc/en-us/articles/39011331286420  https://support.phoneburner.com/hc/en-us/articles/39011468714260  https://support.phoneburner.com/hc/en-us/articles/38939703296020  https://support.phoneburner.com/hc/en-us/articles/39835730484500 |
| Chrome extension | Dial Session Companion for Chrome and Edge launches sessions from CRMs without native support. | https://support.phoneburner.com/hc/en-us/articles/48500081018132 |
| Trust and Safety, STIR/SHAKEN | Compliance FAQs, STIR/SHAKEN guide (calls routed through carrier partners that sign them), Free Caller Registry registration, spam flag guidance, A2P registration. | https://support.phoneburner.com/hc/en-us/articles/360061955111  https://support.phoneburner.com/hc/en-us/articles/360061186971  https://support.phoneburner.com/hc/en-us/articles/5546775314452  https://support.phoneburner.com/hc/en-us/articles/360054041772 |
| Changelog | What's New, Summer 2026 video article. | https://support.phoneburner.com/hc/en-us/articles/51757177595156 |

### 4c. JustCall Sales Dialer (help.justcall.io)

| Screen or area | What the documentation shows | Help doc URL |
| --- | --- | --- |
| Left navigation (11 items, per docs) | New Campaign, Dashboard (Call Analytics, Agent Analytics), Campaigns, Live Report, All Contacts, Phone Numbers, All Calls (logs and scheduled calls), JustCall AI, Settings, Integrations, Workflows. | https://help.justcall.io/en/articles/2285760-sales-dialer-dashboard-overview |
| New Campaign wizard | Step 1 dialing mode: One at a Time (Power, Dynamic) or Multiple at a Time (Predictive). Step 2 add contacts (CSV or CRM). Step 3 map fields. Then country code, fallback number field, campaign settings, Finish Setup. | https://help.justcall.io/en/articles/10510795-how-to-create-a-sales-dialer-campaign  https://help.justcall.io/en/articles/9916769-creating-a-campaign-from-a-csv-file-in-sales-dialer |
| Campaign types | Power: one agent, one contact at a time (Pro and up). Dynamic: shared, one at a time per agent, add or remove contacts live (SalesPro). Predictive: shared, 1 to 10 lines per agent (SalesPro). | https://help.justcall.io/en/articles/10520971-choosing-the-right-sales-dialer-campaign  https://help.justcall.io/en/articles/9914511-what-is-dynamic-dialer |
| Power and Dynamic campaign settings | Dial contacts using (any account number or selected numbers), Forward incoming callbacks to, Assign member, Disposition groups, Call script, Order of dialing (first or last added), Reattempt rules (global or custom). | https://help.justcall.io/en/articles/10510795-how-to-create-a-sales-dialer-campaign |
| Predictive campaign settings | Default number (or random), Max calls per agent (1 to 10), dialing order, disposition groups, auto-drop voicemail on machine, audio to play on abandoned call, script, default country code, forward callbacks. | https://help.justcall.io/en/articles/9099715-predictive-dialer-campaign-settings  https://help.justcall.io/en/articles/8707391-simultaneous-calls-in-predictive-dialer |
| Campaign management | Pause, resume, re-run (Power and multi-line only), campaign Scheduled Calls view, reasons a campaign ends. | https://help.justcall.io/en/articles/12054100-how-to-manage-your-sales-dialer-campaigns  https://help.justcall.io/en/articles/5299073-how-to-re-run-a-sales-dialer-campaign  https://help.justcall.io/en/articles/6725677-schedule-call-back-section-in-sales-dialer  https://help.justcall.io/en/articles/8707380-reasons-for-auto-and-predictive-dialer-campaign-ending |
| Settings > Dialing Experience (all dialers) | Auto Classify Pickups, Cool Off Time, Number Privacy (masks digits), Call Recording, Calling Data Center, Local Presence, Show After Call Work screen (Mandatory Disposition, Mandatory Call Ratings, ACW timeout), Forward Incoming Calls To. | https://help.justcall.io/en/articles/11065197-sales-dialer-account-settings-explained |
| Settings > Predictive | Answering Machine Screening, Drop Voicemail After Beep (30 s fallback), wait time before abandoning, voicemail before abandoning, Transfer List. | https://help.justcall.io/en/articles/11065197-sales-dialer-account-settings-explained  https://help.justcall.io/en/articles/8559982-understanding-answering-machine-screening-in-predictive-dialer |
| Settings > Data and Objects | Custom fields (number and dropdown types documented) and dispositions organized into groups. | https://help.justcall.io/en/articles/6976943-dropdown-custom-fields  https://help.justcall.io/en/articles/5917202-group-disposition-in-sales-dialer |
| Settings > Administrative and Reports | Agent permissions moved to Roles and Permissions; Teams replaced by User Groups. Reports: define success (by disposition or rating), weekly and daily email reports, campaign analytics reports. | https://help.justcall.io/en/articles/11065197-sales-dialer-account-settings-explained  https://help.justcall.io/en/articles/2282298-define-success-of-calls-in-sales-dialer-campaign |
| Reattempt rules | Global rules (set per campaign type) and custom per-campaign rules. Each rule sets an interval and count. Priority setting: dial reattempts first or new leads first. | https://help.justcall.io/en/articles/11274938-sales-dialer-reattempt-rules-a-quick-guide  https://help.justcall.io/en/articles/9324024-setting-priorities-for-reattempt-rules-and-new-leads-in-campaigns |
| Scheduled calls (callbacks) | Schedule Call on the wrap-up screen. Fires automatically for the agent who booked it, only while the campaign is active. Option to skip reattempt rules for that contact. | https://help.justcall.io/en/articles/5959137-scheduled-calls-in-sales-dialer-campaigns |
| Calling hours | Timezone-based windows per region, up to three per country, state-level where supported. Out-of-window contacts are held and rescheduled; agents cannot override. CRM or CSV timezone field supported. | https://help.justcall.io/en/articles/10501459-calling-hours-in-sales-dialer  https://help.justcall.io/en/articles/14085836-use-a-crm-csv-timezone-field-for-timezone-calling |
| Voicemail drop | Upload audio (local, Dropbox, Google Drive). Drop manually in a call. Predictive can auto-drop after the beep. | https://help.justcall.io/en/articles/2284979-upload-voicemail-in-sales-dialer-campaign  https://help.justcall.io/en/articles/2285649-drop-voicemail-to-contact-in-sales-dialer-campaign |
| Auto-classify pickups (AMD) | Labels each connected call human or machine. Free on SalesPro; $0.009 per connected call on other plans per the article. Manual edit of pickup details is a permission. | https://help.justcall.io/en/articles/12097719-auto-classify-pickups-in-sales-dialer-automatically-classify-calls-as-human-or-machine-answered |
| Phone Numbers page | Dialer-only numbers (separate from JustCall numbers, outbound only). Number Health: Healthy, Learning, At Risk. Local number bundles (SalesPro add-on). | https://help.justcall.io/en/articles/2282341-separate-number-for-sales-dialer  https://help.justcall.io/en/articles/13267836-managing-number-health-and-improving-connect-rates-in-sales-dialer  https://help.justcall.io/en/articles/12959562-introducing-custom-local-number-bundles |
| Local presence and spam practices | US and Canada match by area code; other countries by country. Best practices to avoid spam flags. | https://help.justcall.io/en/articles/7851731-local-presence-in-sales-dialer  https://help.justcall.io/en/articles/11100352-best-practices-to-avoid-spam-flags-on-sales-dialer-numbers |
| Alternate number dialing | Number-type custom field. Power and Dynamic: Call Again picks the alternate. Predictive: auto-dials alternate after no answer, voicemail drop, or invalid. | https://help.justcall.io/en/articles/9794932-alternate-number-dialing-in-sales-dialer |
| Scripts | Admin or owner creates scripts with contact attributes. Assigned per campaign. | https://help.justcall.io/en/articles/5302895-sales-script-in-sales-dialer |
| After-call work and dispositions | Mandatory disposition, optional skip of the outcome screen, disposition groups per campaign. | https://help.justcall.io/en/articles/6815820-sales-dialer-make-disposition-selection-mandatory-on-the-after-call-work-screen  https://help.justcall.io/en/articles/6815549-sales-dialer-skip-call-outcome-screen  https://help.justcall.io/en/articles/5917202-group-disposition-in-sales-dialer |
| Workflows | Conditions (call outcome, duration, attempts, rating; AND or OR) then actions: add contact to existing or child campaign (optionally remove from parent), send message, webhook. Email via workflows documented separately. | https://help.justcall.io/en/articles/11568864-workflows-in-sales-dialer  https://help.justcall.io/en/articles/5966213-advanced-workflows-in-sales-dialer  https://help.justcall.io/en/articles/6465785-how-to-send-email-through-workflows-in-sales-dialer |
| Callbacks and inbound | Dialer numbers cannot receive calls; callbacks forward to a JustCall or external number. Option to route callbacks to an AI Voice Agent. Allow incoming calls while busy. | https://help.justcall.io/en/articles/10264613-setting-up-ai-voice-agent-to-handle-callbacks-from-sales-dialer-campaigns  https://help.justcall.io/en/articles/2285632-forward-incoming-calls-in-sales-dialer  https://help.justcall.io/en/articles/16341198-allow-incoming-calls-while-busy-in-sales-dialer |
| Analytics | Agent analytics dashboard, metrics glossary (connect rate, human and machine pickup rate, unclassified), campaign analysis. | https://help.justcall.io/en/articles/6740471-sales-dialer-agent-analytics-dashboard  https://help.justcall.io/en/articles/13406869-sales-dialer-call-analytics-metrics-glossary  https://help.justcall.io/en/articles/2282428-analyse-your-justcall-sales-dialer-campaign |
| Roles and permissions | Custom roles control call logs, recordings, transcripts, contacts (including blacklisted download), campaigns, workflows, numbers, custom fields. | https://help.justcall.io/en/articles/15450992-roles-and-permissions-for-sales-dialer |
| CRM integrations | 27 guides in the Sales Dialer collection: HubSpot, Salesforce, Pipedrive, Zoho, HighLevel, Outreach, Salesloft, Apollo, Copper, Freshsales, Follow Up Boss, Keap, others; two-way custom field sync; integration logs. Product page claims 70+ native integrations. | https://help.justcall.io/en/articles/8710664-create-sales-dialer-campaigns-using-hubspot-lists-and-sequences  https://help.justcall.io/en/articles/9919912-how-to-map-sales-dialer-fields-with-crm-fields  https://help.justcall.io/en/articles/15900524-how-to-view-integration-logs-in-sales-dialer |
| Plans and trial | Power on Pro, Pro Plus, Business, SalesPro. Dynamic and Predictive on SalesPro. 14-day trial on SalesPro with 3 campaigns per type. | https://help.justcall.io/en/articles/10947950-sales-dialer-subscription-plans-free-trial-guide  https://help.justcall.io/en/articles/9895178-understanding-sales-dialer-trial-and-plans |
| Mobile apps | iOS and Android apps support calling and campaign management; full configuration is web only. | https://help.justcall.io/en/articles/10373912-sales-dialer-mobile-app-for-ios  https://help.justcall.io/en/articles/11756724-sales-dialer-mobile-app-for-android |

## 5. Feature matrix against Transovo

Counts: Missing 31, Partial 11, Have 3, Unverified 6 (total 51).

### 5a. Vendor comparison

| Category | Feature | Kixie | PhoneBurner | JustCall |
| --- | --- | --- | --- | --- |
| Dialing modes | Single-line power dialing (auto-dial next) | Yes, 1-line tier | Yes, Power Dialing (most popular mode) | Yes, Power campaign (one agent) |
| Dialing modes | Pause and preview (review before dial) | Not found as a named mode; Session tab shows Reserved Contacts | Yes, Pause and Preview mode and presets | Not found as a named mode; Cool Off Time pauses between calls |
| Dialing modes | Multi-line / parallel dialing | Yes, up to 4 lines on pricing page (help article says up to 10) | No, single line by design (third-party comparisons, not PB docs) | Yes, Predictive 1 to 10 lines per agent (SalesPro) |
| Dialing modes | Machine-filtered multi-line (AI human detect) | Yes, AI Human Detect add-on, 2 to 5 s timeout | Not applicable | Yes, Answering Machine Screening, 4 to 5 s delay |
| Dialing modes | Shared queue across agents | PowerLists assigned to Teams | LeadStream distribution | Dynamic Dialer (SalesPro) |
| Lists and contacts | CSV import with column mapping | Yes, visual mapping tool; invalid numbers auto-removed | Yes, mapping, duplicate screening, invalid finder | Yes, mapping; create custom fields in flow |
| Lists and contacts | Custom fields | 7 standard plus 6 custom | Custom field types and mapping | Number and dropdown custom fields documented |
| Lists and contacts | Multiple numbers per contact | Contact Groups plus actions (always use, remove number, remove contact) | Next Number or Next Contact after disposition | Alternate number field; predictive auto-dials it |
| Lists and contacts | List eligibility stats | Total, Queued, In Progress, Deferred, Removed | Contact Manager searches and folders | Campaign analytics and scheduled calls view |
| Lists and contacts | Add or remove contacts via API or automation | PowerList API, HubSpot and HighLevel actions, Zapier | API, Zapier, webhooks | Workflows, live CRM sync (Dynamic) |
| Lists and contacts | CRM list as dial source | HubSpot static list import | Dial sessions launched from CRM | CRM or CSV at campaign creation |
| Retry and scheduling | Retry delay between attempts | Min Duration Before Call Retry | Not found as an automatic setting; reps re-run lists | Reattempt Rules with intervals |
| Retry and scheduling | Attempt caps | Daily max (default 2) and total max (default 10) | Reset Call Attempts (2026); no cap setting found | Reattempt count |
| Retry and scheduling | Callback scheduling | Do Not Call Sooner Than date | Follow-up disposition with required date; Appointments calendar | Schedule Call auto-fires for that agent |
| Retry and scheduling | Auto-advance and cool-off | Next number dials after outcome saved | Next contact after disposition | Cool Off Time and ACW timeout |
| Retry and scheduling | Ring timeout | Seconds Before Timeout (30 default) | Ring duration (25 s to 40+ s) | Not found in pages read |
| Retry and scheduling | List priority and waterfall | 5 priority levels plus Next PowerList | Not found | Reattempts-first or new-leads-first |
| Session screen | Session start, pause, resume, end | Yes | Yes; resume within 60 days | Pause and resume campaign |
| Session screen | Contact panel with context | Name, title, company, email, 6 custom, notes, CRM deal | Contact record with layouts | Contact fields and custom fields |
| Session screen | Scripts with merge fields | PowerList Notes field; no script tool found | Phone Scripts with merge codes | Scripts per campaign with attributes |
| Session screen | Custom dispositions | Call Outcomes, ordered | Dialing set and live answer set, fully custom | Disposition groups per campaign |
| Session screen | Disposition-driven actions | Remove, forward to list, assign owner, cadence | Move folder, tag, email, SMS, DNC, webhook | Workflows: add to campaign, message, webhook |
| Session screen | Require disposition before next dial | Require Call Outcome (default on) | Undispositioned calls are not counted | Mandatory Call Disposition |
| Session screen | In-call tools (hold, transfer, mute) | Transfer, 3-way, hold | Hold, warm transfer, mute | Transfer list |
| Session screen | Keyboard shortcuts | Yes (open, answer, call, end) | Not found | Not found |
| Voicemail and AMD | Voicemail drop | Yes, MP3 or record; AI beep detection | Yes, one-click from library | Yes; auto after beep in predictive |
| Voicemail and AMD | Human vs machine detection | AI Human Detect add-on | Not documented | Auto-Classify Pickups ($0.009 per connected call off SalesPro) |
| Voicemail and AMD | Abandoned-call handling | Not found | Not applicable (one-to-one) | Abandon wait time and recorded message |
| Numbers and caller ID | Local presence | Standard and ConnectionBoost | Approval-gated feature | US and Canada by area code |
| Numbers and caller ID | Number pools and rotation | Progressive rotation, 50+ per area code | Number Pools, random or local | Selected numbers or any; rotation |
| Numbers and caller ID | Number health and spam monitoring | Reputation Manager, Hiya and First Orion | ARMOR add-on | Number Health status |
| Numbers and caller ID | Callback routing for dialer numbers | Routes to last agent | Pool routing strategies | Forward callbacks to a set number |
| Numbers and caller ID | CNAM and branded caller ID | Outbound Caller ID Name | CNAM and branded caller ID | Not found |
| Compliance | Calling hours by contact time zone | Target Hours from area code | Default 8 am to 9 pm; per-day hours (2026) | Windows per region; holds and reschedules |
| Compliance | Internal DNC list | Remove contact or number actions; block a number | DNC list, number or whole contact | Blacklisted contacts exist |
| Compliance | National DNC scrub | Probabilistic DNC Algorithm add-on | DNC.com integration (separate subscription) | None found; buyer responsibility per product page |
| Compliance | Consent tracking | Not found | Not found | Consent field per contact (product page) |
| Compliance | Recording consent modes | All, None, Two-Party by area code | Live answers only; admin controls | On or off for dialer |
| Compliance | Frequency caps | Harassment Rules (auto-calls only) | Not found | Not found |
| Compliance | Area code allow or block | Restricted Calling Areas | Limit Area Codes | Country code required |
| Compliance | STIR/SHAKEN | Not found in docs read | All calls via signing carrier partners | Supports attestation (product page) |
| Team and reporting | Roles and permissions | User vs Manager; manager options | Admin, supervisor, per-user permissions | Custom roles for dialer data |
| Team and reporting | Live board and monitoring | Live Call Board; listen, whisper, barge | Live dashboard; coaching on Professional | Live Report; listen, whisper, join |
| Team and reporting | Dashboards and reports | Snapshots, agent status, summary | Standard and custom reports, emailed | Call and agent analytics, leaderboard |
| Team and reporting | Call history and recordings | Call History with source and PowerList | Call History and recordings | All Calls with logs |
| Messaging and AI | SMS follow-up from disposition | SMS template on outcome tab | SMS on disposition (Premium, A2P) | Send message action in workflows |
| Messaging and AI | Call transcripts and AI summaries | Conversation Intelligence add-on | Premium AI note taker | JustCall AI |
| Messaging and AI | AI agent for callbacks | AI agents at ai.kixie.com | Not found | AI Voice Agent for callbacks |
| Integrations | Native CRM | HubSpot, Salesforce, Pipedrive, Zoho, HighLevel and more | Salesforce, HubSpot, Zoho, GoHighLevel and more | 70+ (product page) |
| Integrations | Webhooks and API | Call outcome, start call, voicemail webhooks; PowerList API | Call begin and end, disposition webhooks; PAT API | Workflow webhooks; developer API |
| Integrations | Browser extension or click-to-call | Chrome extension, click-to-call | Chrome and Edge companion | Mobile apps |

### 5b. Transovo gap

| Category | Feature | Transovo status | Detail | Priority |
| --- | --- | --- | --- | --- |
| Dialing modes | Single-line power dialing (auto-dial next) | Partial | Agent clicks Call for each lead; Save and next advances but nothing auto-dials. | Launch |
| Dialing modes | Pause and preview (review before dial) | Have | Inferred: today every call needs a click, which is effectively preview. Keep as a mode toggle. | Launch |
| Dialing modes | Multi-line / parallel dialing | Missing | WebRTC softphone is one leg. Parallel needs server-side origination plus bridging. | Later |
| Dialing modes | Machine-filtered multi-line (AI human detect) | Missing | Needs AMD first. | Later |
| Dialing modes | Shared queue across agents | Missing | No team queues. | Next |
| Lists and contacts | CSV import with column mapping | Partial | Paste import of name, phone, company only. No mapper, dedupe, or invalid-number cleanup. | Launch |
| Lists and contacts | Custom fields | Missing | Only name, phone, company. | Launch |
| Lists and contacts | Multiple numbers per contact | Missing | One phone per contact. | Next |
| Lists and contacts | List eligibility stats | Missing | No queued or deferred counts. | Launch |
| Lists and contacts | Add or remove contacts via API or automation | Missing | No inbound API into lists (not verified). | Next |
| Lists and contacts | CRM list as dial source | Missing | No CRM integrations. | Next |
| Retry and scheduling | Retry delay between attempts | Partial | retryDelayMinutes (60) stored but not enforced. | Launch |
| Retry and scheduling | Attempt caps | Partial | Total maxAttempts (3) enforced. No daily cap. | Launch |
| Retry and scheduling | Callback scheduling | Missing | Callback is a disposition only; no scheduler. | Launch |
| Retry and scheduling | Auto-advance and cool-off | Missing | Save and next is manual. | Launch |
| Retry and scheduling | Ring timeout | Unverified | Not stated in inventory. | Launch |
| Retry and scheduling | List priority and waterfall | Missing | No priority between lists. | Next |
| Session screen | Session start, pause, resume, end | Have | Sessions exist with all four actions. | Launch |
| Session screen | Contact panel with context | Partial | Name, company, notes. | Launch |
| Session screen | Scripts with merge fields | Missing | No scripts. | Launch |
| Session screen | Custom dispositions | Partial | Nine fixed dispositions. | Launch |
| Session screen | Disposition-driven actions | Missing | Dispositions only record. | Launch |
| Session screen | Require disposition before next dial | Unverified | Not stated. | Launch |
| Session screen | In-call tools (hold, transfer, mute) | Missing | Not in power dialer inventory. | Next |
| Session screen | Keyboard shortcuts | Missing | None listed. | Later |
| Voicemail and AMD | Voicemail drop | Missing | No voicemail drop. | Launch |
| Voicemail and AMD | Human vs machine detection | Missing | No AMD. | Launch |
| Voicemail and AMD | Abandoned-call handling | Missing | Only matters for multi-line. | Later |
| Numbers and caller ID | Local presence | Missing | One caller ID per campaign. | Launch |
| Numbers and caller ID | Number pools and rotation | Missing | No pools. | Launch |
| Numbers and caller ID | Number health and spam monitoring | Missing | None. | Next |
| Numbers and caller ID | Callback routing for dialer numbers | Unverified | Telnyx inbound routing exists; mapping to dialer numbers not verified. | Launch |
| Numbers and caller ID | CNAM and branded caller ID | Missing | None. | Later |
| Compliance | Calling hours by contact time zone | Missing | Campaign has a timezone field; no enforcement listed. | Launch |
| Compliance | Internal DNC list | Partial | Do not call disposition exists; contacts BLOCKED or UNSUBSCRIBED are skipped. Whether the disposition writes BLOCKED is unverified. | Launch |
| Compliance | National DNC scrub | Missing | None. | Launch |
| Compliance | Consent tracking | Missing | None. | Next |
| Compliance | Recording consent modes | Partial | HumanCall rows exist; no in-session recording UI or consent mode. | Launch |
| Compliance | Frequency caps | Missing | Daily attempt cap would cover it. | Next |
| Compliance | Area code allow or block | Missing | None. | Later |
| Compliance | STIR/SHAKEN | Unverified | Carrier-side; check Telnyx attestation level per number. | Launch |
| Team and reporting | Roles and permissions | Missing | No team queues or roles. | Next |
| Team and reporting | Live board and monitoring | Missing | None. | Later |
| Team and reporting | Dashboards and reports | Partial | Campaign rollups in phone analytics. | Launch |
| Team and reporting | Call history and recordings | Have | HumanCall rows in /app/phone/calls. | Launch |
| Messaging and AI | SMS follow-up from disposition | Partial | Transovo has SMS elsewhere; not tied to dispositions (inferred). | Next |
| Messaging and AI | Call transcripts and AI summaries | Unverified | Transovo has AI voice stack; dialer link not verified. | Next |
| Messaging and AI | AI agent for callbacks | Partial | Ava exists for inbound; not wired to dialer numbers (inferred). Possible differentiator. | Later |
| Integrations | Native CRM | Missing | None. | Next |
| Integrations | Webhooks and API | Unverified | Not in the inventory. | Next |
| Integrations | Browser extension or click-to-call | Missing | None. | Later |

Transovo status is taken from the repo inventory in the brief. Items marked Unverified were not listed there. Priority is a recommendation, not a vendor claim.

## 6. Telnyx and Twilio requirements

| Capability | Telnyx | Twilio | Source |
| --- | --- | --- | --- |
| Answering machine detection | answering_machine_detection on Dial: detect, detect_beep, detect_words, greeting_end, premium (human_residence, human_business, machine, silence, fax_detected, not_sure), premium_ios_call_screening_detection. Webhooks call.machine.premium.detection.ended and .greeting.ended. | MachineDetection=DetectMessageEnd, optional AsyncAmd=true with AsyncAmdStatusCallback; AnsweredBy values include machine_end_beep. | https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection  https://www.twilio.com/docs/voice/answering-machine-detection |
| Voicemail drop | On premium greeting.ended with beep_detected, call Play Audio or Speak on the call leg. | In the async callback, update the live call with TwiML that plays the recording. | Same two links; Twilio blog on async AMD |
| Recording | record=record-from-answer on Dial returns a recording_id. | Not researched here. | https://apispec.telnyx.com/dial-17988585e0 |
| Parallel and predictive dialing | Server-side outbound legs plus bridging to the agent are needed. Today's softphone path is one WebRTC leg. Inferred, not a vendor statement. | Same, inferred. | Inferred |
| Local presence and number pools | Selection logic is app-side: pick an owned number by area code. Telnyx and Twilio sell numbers by area code (not re-verified). | Same. | Inferred |
| STIR/SHAKEN, CNAM, branded calling, spam remediation | Attestation and reputation tooling not verified for Telnyx in this research. | Not verified. | Check with ISV contacts |

## 7. Compliance items

| Topic | What the source says | Source | Implication for Transovo |
| --- | --- | --- | --- |
| Calling hours | Telemarketers may not call before 8 am or after 9 pm local time of the called person. PhoneBurner defaults to this window and warns some states are stricter. | https://support.phoneburner.com/hc/en-us/articles/115005668723 | Enforce per contact using area-code time zone; allow stricter state overrides. |
| National DNC and prior statements | Calling a number on the FTC registry, or one that asked not to be called by the seller, is prohibited unless there is written agreement or an established business relationship. | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310/section-310.4 | Internal DNC plus a registry scrub source. No vendor reviewed ships a free scrub. |
| Abandoned calls (multi-line only) | Safe harbor: at most 3 percent of answered calls abandoned per campaign over 30 days, ring at least 15 seconds or 4 rings, play a recorded message naming the seller if no rep within 2 seconds, keep records. | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310 | Reason to ship single-line first. Parallel needs abandonment tracking and a recorded message. |
| Prerecorded messages | Telemarketing calls that deliver a prerecorded message need express written agreement under 16 CFR 310.4(b)(1)(v). Whether a voicemail drop falls under this was not researched; get counsel before shipping drop. | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310/section-310.4 | Gate voicemail drop behind a consent or acknowledgement setting. |
| Recording consent | Kixie offers All, None, Two-Party by area code. PhoneBurner and JustCall expose on or off. | https://support.kixie.com/hc/en-us/articles/30128591092763 | Add a consent mode, default to two-party-safe. |
| Texting | A2P 10DLC registration is required for SMS. PhoneBurner charges a $50 application fee and gates SMS to Premium. | https://support.phoneburner.com/hc/en-us/articles/37916865941908 | Keep SMS follow-up behind existing Transovo registration. |
| Vendor stance | JustCall says consent handling and suppression are the buyer's responsibility. Kixie publishes a legal disclaimer for its DNC algorithm. | https://justcall.io/product/auto-dialer/ | Add terms and an in-product acknowledgement. Not legal advice. |

This is a research summary, not legal advice. TCPA and state-level rules were not researched in depth.

## 8. Prioritized build list

| Phase | Area | What to build | Effort (my estimate) | Depends on |
| --- | --- | --- | --- | --- |
| Launch 1 | Calling engine rules | Auto-advance with cool-off, enforce retry delay, daily and total attempt caps, ring timeout, mandatory disposition, ineligible reasons (Queued, Deferred, Removed counts). | M | None (app logic) |
| Launch 1 | Compliance basics | Contact-time-zone calling hours from area code, internal DNC list wired to the Do not call disposition, DNC list upload, consent acknowledgement, recording consent mode. | M | Counsel review; registry scrub source |
| Launch 1 | Lists | CSV mapper with custom fields, dedupe, invalid number removal, list status counts, clone campaign. | M | None |
| Launch 1 | Dispositions and scripts | Custom disposition sets with actions (remove from list, move to list, schedule callback, add to DNC), scripts with merge fields, callback scheduler that fires for the agent. | M | None |
| Launch 2 | Voicemail drop and AMD | Voicemail library (upload or record), AMD classification, auto drop after beep. | M | Telnyx premium AMD or Twilio async AMD |
| Launch 2 | Numbers | Number pool per campaign, local presence by area code, callback routing for dialer numbers. | M | Owned numbers across area codes |
| Launch 2 | Reporting | Campaign and agent reports, disposition summary, connect and human-pickup rate, call history filter by campaign. | S to M | AMD for pickup rate |
| Next | Messaging and AI | SMS template per disposition, AI call summary on the attempt, Ava-handled callbacks. | M | Existing SMS registration; AI stack |
| Next | Team | Roles and permissions, shared campaigns, live board, listen and whisper. | L | Telnyx call control |
| Next | Integrations | Add-to-list API and webhooks (call end, disposition), then HubSpot and HighLevel. | M to L | None |
| Next | Number health | Daily dial volume per number with Healthy, Learning, At Risk status. | S | Usage data |
| Later | Multi-line | 2 to 3 lines per agent with AMD filter, abandonment tracking, recorded abandon message. | L | Server-side origination and bridging; TSR safe harbor |
| Later | Predictive and distribution | Predictive pacing, lead distribution, conversation scoring. | L | Compliance |
| Later | Caller ID branding | CNAM, branded calling, spam remediation workflows. | M | Carrier and vendor support |

## 9. Proposed Power Dialer menu

| Menu item | Contents | Modeled on | Phase |
| --- | --- | --- | --- |
| Overview | Today's sessions, dials, connects, callbacks due, campaigns running, setup checklist | Kixie Business Snapshot; JustCall Dashboard | Launch 1 |
| Dial | Session screen: pick campaign(s), start, pause, end; contact card, script, disposition bar, notes, voicemail drop button | Kixie Session and Outcome tabs; PhoneBurner dial session | Launch 1 |
| Campaigns | List with status, eligible count, attempts. Create or edit wizard: Contacts, Rules, Numbers, Voicemail, Script, Dispositions, Compliance, Members. Clone. | Kixie PowerLists; JustCall New Campaign | Launch 1 |
| Lists | Contact lists, import and mapper, custom fields, view contacts with Queued, In progress, Deferred, Removed filters | Kixie View Contacts; PhoneBurner Contact Manager | Launch 1 |
| Callbacks | Scheduled calls by agent and campaign, overdue first | JustCall Scheduled Calls; Kixie Do Not Call Sooner Than | Launch 1 |
| Scripts | Script editor with merge fields; assign per campaign | PhoneBurner Phone Scripts; JustCall Scripts | Launch 1 |
| Dispositions | Disposition sets and rules (remove, move, callback, DNC, SMS) | Kixie Call Outcomes; PhoneBurner Dispositions | Launch 1 |
| Voicemail drops | Library, record or upload, default per campaign | Kixie VM Drop; PhoneBurner Voicemail Library | Launch 2 |
| Numbers | Caller ID per campaign, number pools, local presence, health status, callback routing | PhoneBurner Number Pools; JustCall Phone Numbers | Launch 2 |
| Compliance | Calling hours, DNC lists and scrubs, attempt caps, recording consent, acknowledgement | Kixie Account Settings; PhoneBurner Calling Times and DNC | Launch 1 |
| History | Existing /app/phone/calls filtered to dialer calls with campaign and disposition | Kixie Call History | Launch 1 |
| Reports | Campaign, agent, disposition, connect rate | PhoneBurner Reports; Kixie Reporting | Launch 2 |
| Team and live board | Members, roles, live status, listen and whisper | Kixie Live Call Board | Next |
| Integrations | API keys, webhooks, CRM connections | Kixie Integrations; PhoneBurner API | Next |

## 10. Gaps and unverified items

- Kixie's help article says PowerDialer tiers reach 10 lines; its pricing page says up to 4. Confirm with Kixie.
- Orum, Close, CloudTalk, Aircall, and Mojo were not reviewed. Say so if you want a fourth teardown.
- Compliance behavior was read only where articles mention calling hours, DNC, and consent. Neither PhoneBurner nor JustCall documents a registry scrub of its own.
- Transovo items marked Unverified need a quick check in the repo: ring timeout, required disposition, whether Do not call writes BLOCKED, webhooks and API, inbound routing for outbound numbers.
- Telnyx STIR/SHAKEN attestation, CNAM, and branded calling were not researched.
- Effort sizes are my rough estimates, not from any source.

## Appendix A. Transovo power dialer inventory used (from the brief)

- Location: new-app at /app/phone/power-dialer.
- Has: contact lists with CSV paste import (name, phone, company); campaigns (name, list, caller ID, status, timezone, configJson maxAttempts 3, retryDelayMinutes 60 stored but NOT enforced); sessions (start, pause, resume, end); attempts with dispositions (Booked, Interested, Callback, No answer, Voicemail, Not interested, Wrong number, Do not call, Skip); notes; Save & next; WebRTC outbound through the Telnyx softphone; HumanCall rows in /app/phone/calls; campaign rollups in phone analytics; next-lead skips contacts BLOCKED or UNSUBSCRIBED and those at maxAttempts.
- Missing (per brief): predictive or parallel dialing, auto-advance, retry delay enforcement, callback scheduler, list eligibility stats, DNC / quiet hours / state rules, scripts and merge fields, AMD, voicemail drop, team queues and custom dispositions, local presence, CRM integrations, call recording UI within session, reporting beyond rollups, rich campaign editor.

## Appendix B. Dialer-relevant help-center article index

Full inventories came from the vendors' public help-center listings. Kixie 255 articles and PhoneBurner 497 articles were indexed; this appendix lists the dialer-relevant subset (Kixie: troubleshooting, SIP ALG, desk phone, audio, billing, and CRM-specific articles omitted; PhoneBurner: Salesforce, Zoho, HubSpot, GoHighLevel, Nimble, Outreach, Zapier, Emailing, most Contact Management and Team Accounts articles omitted; JustCall: the 27 CRM integration guides omitted, see section 4c).

### Kixie (135 articles)


**Multiline PowerDialer**

- How to Delete Contacts from a PowerList - https://support.kixie.com/hc/en-us/articles/18730525589787
- How to Set Up PowerLists - https://support.kixie.com/hc/en-us/articles/4565589331483
- Introduction to the PowerDialer Window - https://support.kixie.com/hc/en-us/articles/4582890954907
- PowerDialer Contact Management Actions - https://support.kixie.com/hc/en-us/articles/27053556553115
- PowerDialer with AI Human Detect - https://support.kixie.com/hc/en-us/articles/22656918351259
- PowerDialer with AI Human Detect FAQs - https://support.kixie.com/hc/en-us/articles/24665570825755
- PowerList - View Contacts page - https://support.kixie.com/hc/en-us/articles/18570135631515
- PowerList API - https://support.kixie.com/hc/en-us/articles/19135310564635

**Outbound Calling**

- How Local Presence Dialing Works - https://support.kixie.com/hc/en-us/articles/4585141066779
- International Calling & List of Blocked Countries - https://support.kixie.com/hc/en-us/articles/115003562533
- Outbound Caller ID Name - https://support.kixie.com/hc/en-us/articles/360022541233
- PowerList Next Action - https://support.kixie.com/hc/en-us/articles/20406923205275
- Prioritized PowerLists: Speed to Lead with Continuous Follow-up - https://support.kixie.com/hc/en-us/articles/20404809914523
- Restricted Calling Areas - https://support.kixie.com/hc/en-us/articles/360013144614
- What is Kixie ConnectionBoost? - https://support.kixie.com/hc/en-us/articles/360057490914

**Call Recording and Transcription**

- Call Recording FAQs - https://support.kixie.com/hc/en-us/articles/360019966353
- Conversation Intelligence - https://support.kixie.com/hc/en-us/articles/17657473883419
- Conversation Intelligence FAQs - https://support.kixie.com/hc/en-us/articles/18268701117979
- How Do I Control Settings for Call Recordings? - https://support.kixie.com/hc/en-us/articles/360009448814
- How to Access and Filter Call History as a Manager in Kixie - https://support.kixie.com/hc/en-us/articles/19077710635163
- Two-Party Consent and TCPA Compliance - https://support.kixie.com/hc/en-us/articles/4404258992923

**Dialer Settings**

- Changing my Outbound Caller ID Phone Number - https://support.kixie.com/hc/en-us/articles/4423273951003
- Connecting your CRM to Kixie - https://support.kixie.com/hc/en-us/articles/4422726101531
- Kixie Connect: Using your cell phone or existing phone service with Kixie - https://support.kixie.com/hc/en-us/articles/4423458188955
- Kixie PowerCall Keyboard Shortcuts / Hotkeys - https://support.kixie.com/hc/en-us/articles/4685749871131
- Setting your Country Code for Outbound Dialing - https://support.kixie.com/hc/en-us/articles/4423387995803

**Call Features**

- Call Forwarding and the "Find Me, Follow Me" Feature - https://support.kixie.com/hc/en-us/articles/360009305673
- Click-to-call FAQs - https://support.kixie.com/hc/en-us/articles/360016568533
- How do I use Kixie Click-To-Call? - https://support.kixie.com/hc/en-us/articles/208338457
- Transfer and Conference 3-Way Calls - https://support.kixie.com/hc/en-us/articles/4583510976027
- Using Call Waiting - https://support.kixie.com/hc/en-us/articles/18931182724507
- Using DND (Do Not Disturb) - https://support.kixie.com/hc/en-us/articles/4426212892571

**Managing your Team**

- Adding Agents on the Kixie Dashboard - https://support.kixie.com/hc/en-us/articles/4429226824987
- Assigning and Reassigning Phone Numbers to Agents - https://support.kixie.com/hc/en-us/articles/18954796970395
- Call Coaching Agents in the Kixie Directory - https://support.kixie.com/hc/en-us/articles/4426421020187
- Creating and Managing Teams - https://support.kixie.com/hc/en-us/articles/360041587874
- Live Call Board - https://support.kixie.com/hc/en-us/articles/21041171199387
- Replacing Vs. Deleting Users - https://support.kixie.com/hc/en-us/articles/227010668
- Setting up Live Leaderboards - https://support.kixie.com/hc/en-us/articles/13010009538203

**Manage your Account**

- Filter Kixie Email Notifications - https://support.kixie.com/hc/en-us/articles/4402039898523
- How Kixie Helps Companies Stay TCPA Compliant - https://support.kixie.com/hc/en-us/articles/30128591092763
- How to Block a Number - https://support.kixie.com/hc/en-us/articles/1260803765530
- Kixie Dashboard Access for Manager & Admin Profiles - https://support.kixie.com/hc/en-us/articles/4404608409755
- Kixie GDPR (General Data Protection Regulation) Compliance - https://support.kixie.com/hc/en-us/articles/360002758574
- Manage Business Hours and Voicemails for After Hours Calls - https://support.kixie.com/hc/en-us/articles/18787546339995
- Manager Dashboard: Account Settings - https://support.kixie.com/hc/en-us/articles/4405882549531
- Setting Connection Duration for Calls - https://support.kixie.com/hc/en-us/articles/360004461473
- Setting up Call Disposition Outcomes - https://support.kixie.com/hc/en-us/articles/4582727772955

**Reporting & Analytics**

- Agent Snapshot Report - https://support.kixie.com/hc/en-us/articles/18085747066651
- Agent Status & Workforce Mgmt FAQs - https://support.kixie.com/hc/en-us/articles/17651339202715
- Agent Status & Workforce Mgmt Overview - https://support.kixie.com/hc/en-us/articles/17465386328091
- Business Snapshot FAQs - https://support.kixie.com/hc/en-us/articles/18263394982427
- Business Snapshot Report - https://support.kixie.com/hc/en-us/articles/17499874438683
- Dashboard Reporting Overview - https://support.kixie.com/hc/en-us/articles/115004810148
- Understanding the Inbound Summary Report in Kixie - https://support.kixie.com/hc/en-us/articles/34532539949083

**Automations and Cadences**

- Creating an Automation Cadence - https://support.kixie.com/hc/en-us/articles/1260803683709
- GoHighLevel Automations: How to Trigger Automations Using Kixie Webhooks - https://support.kixie.com/hc/en-us/articles/25742515171227
- HighLevel Workflow Actions for Kixie - https://support.kixie.com/hc/en-us/articles/35092491864091
- How To Set Up Kixie Auto-SMS with HubSpot Form Submissions - https://support.kixie.com/hc/en-us/articles/16446672208923
- How to Sync Your Kixie PowerList with a HubSpot Active List - https://support.kixie.com/hc/en-us/articles/34305666938907
- HubSpot Workflows: How to Automate Adding Contacts to a PowerList - https://support.kixie.com/hc/en-us/articles/25736095892891
- Kixie Automations - https://support.kixie.com/hc/en-us/articles/6015199041307
- Kixie Call and SMS Automations in HubSpot Workflows - https://support.kixie.com/hc/en-us/articles/4403675667099
- Kixie's Zapier Integration - https://support.kixie.com/hc/en-us/articles/33885592929947
- Send SMS API - https://support.kixie.com/hc/en-us/articles/34368835359387
- Set Up Auto-SMS with HubSpot Email Opens - https://support.kixie.com/hc/en-us/articles/16446551370779
- Zapier Automations: How to Add Facebook Leads to Kixie Powerlist - https://support.kixie.com/hc/en-us/articles/23781590843163

**Agents**

- How do I setup my Voicemail? - https://support.kixie.com/hc/en-us/articles/207315477
- How to Download the Kixie PowerCall Dialer Chrome Extension? - https://support.kixie.com/hc/en-us/articles/360019966513
- How to Work from Home using Kixie - https://support.kixie.com/hc/en-us/articles/360044586374
- New Agent Setup Guide - https://support.kixie.com/hc/en-us/articles/4472693973403
- SMS Templates - https://support.kixie.com/hc/en-us/articles/360013080574
- Setting Up Two-Factor Authentication on Your Kixie Account - https://support.kixie.com/hc/en-us/articles/53350305647515
- Setting up Your Direct Line's Inbound Call Flow - https://support.kixie.com/hc/en-us/articles/40259980714779
- Setting up and using Voicemail Drop - https://support.kixie.com/hc/en-us/articles/4576581944731

**Account Managers & Admins**

- Business Identity and Voice Integrity: How to Register and Protect Your Caller ID - https://support.kixie.com/hc/en-us/articles/55431133322779
- How to Assign an SMS Number to your User Account - https://support.kixie.com/hc/en-us/articles/19075690829339
- New Manager/Admin Setup Guide - https://support.kixie.com/hc/en-us/articles/33938513044251
- Number Warmup Strategies to Avoid Spam Flagging - https://support.kixie.com/hc/en-us/articles/39479985832859
- Onboarding at Kixie - https://support.kixie.com/hc/en-us/articles/41086287321755

**Inbound Call Routing**

- CRM Rules Based Routing FAQs - https://support.kixie.com/hc/en-us/articles/17588281635355
- CRM Rules Based Routing Setup - https://support.kixie.com/hc/en-us/articles/17326350115227
- Enable SMS Notifications for Kixie MaestroAI - https://support.kixie.com/hc/en-us/articles/43550737333787
- Inbound Call Queues FAQs - https://support.kixie.com/hc/en-us/articles/17234547300251
- Inbound Ring Group FAQs - https://support.kixie.com/hc/en-us/articles/17237680413339
- Setting Up an IVR (Phone Tree) - https://support.kixie.com/hc/en-us/articles/4402428065435
- Setting up a Call Queue - https://support.kixie.com/hc/en-us/articles/360047302494
- Setting up a Ring Group - https://support.kixie.com/hc/en-us/articles/4402351318939

**SMS and MMS Messaging**

- 10DLC Registration Recommendations - https://support.kixie.com/hc/en-us/articles/16188947660571
- 10DLC Requirements: Maintaining your Registration and Avoiding Violations - https://support.kixie.com/hc/en-us/articles/40169987182491
- Displaying an SMS Sender ID Instead of Your SMS Number - https://support.kixie.com/hc/en-us/articles/360025657314
- SMS Best Practices — Maximizing SMS Delivery Rates & Minimizing Carrier Blocking - https://support.kixie.com/hc/en-us/articles/360040209593
- SMS Messaging Basics - https://support.kixie.com/hc/en-us/articles/4582396778395
- STOP and START: How Text Opt-Outs Work - https://support.kixie.com/hc/en-us/articles/56952261413275
- Sending MMS with Kixie PowerCall - https://support.kixie.com/hc/en-us/articles/17876795359387
- Setting up and using Team SMS - https://support.kixie.com/hc/en-us/articles/10453600065051
- Why can't I send SMS messages? - https://support.kixie.com/hc/en-us/articles/34512381748251

**My Kixie Numbers**

- Agent Settings: Configuring an Agent's Inbound Call Flow - https://support.kixie.com/hc/en-us/articles/19204756497947
- Default User Numbers FAQs - https://support.kixie.com/hc/en-us/articles/360018985474
- How Do I Transfer (Port) My Existing Phone Numbers to Kixie? - https://support.kixie.com/hc/en-us/articles/220560947
- How to Port Out Your Phone Numbers from Kixie - https://support.kixie.com/hc/en-us/articles/34270250091547
- How to Register your Phone Numbers with Hiya - https://support.kixie.com/hc/en-us/articles/39314424566427
- How to Unblock a Number - https://support.kixie.com/hc/en-us/articles/56952255343131
- If your Kixie phone number(s) need to be activated - https://support.kixie.com/hc/en-us/articles/115000768587
- Purchasing a New Phone Number for an Agent - https://support.kixie.com/hc/en-us/articles/18813083475739
- Replacing a Kixie Number That Is Showing as Spam - https://support.kixie.com/hc/en-us/articles/18054798288283
- Showing Up as Spam Likely or Scam Likely - https://support.kixie.com/hc/en-us/articles/360057501594
- Taking ConnectionBoost to the Next Level - https://support.kixie.com/hc/en-us/articles/34120536779803
- Why Are My ConnectionBoost Numbers Showing as Spam? - https://support.kixie.com/hc/en-us/articles/34270542959515

**AI Dashboard Basics**

- Kixie AI Dashboard | Introduction - https://support.kixie.com/hc/en-us/articles/55213444516507

**Reports and Dashboards**

- Kixie AI Dashboard | How to build a custom report with the structured report builder - https://support.kixie.com/hc/en-us/articles/56052917495963
- Kixie AI Dashboard | How to build reports and dashboards - https://support.kixie.com/hc/en-us/articles/56471251149851
- Kixie AI Dashboard | How to read Business snapshot and use ready-made dashboards - https://support.kixie.com/hc/en-us/articles/56471208676507

**Calls, Scoring and Playbooks**

- Kixie AI Dashboard | How to review calls, scores and Playbooks - https://support.kixie.com/hc/en-us/articles/56521749445787

**AI Agents**

- Kixie AI Dashboard | How to set up and manage AI agents - https://support.kixie.com/hc/en-us/articles/56521801751963

**Integrations**

- Kixie AI Dashboard | How to connect integrations - https://support.kixie.com/hc/en-us/articles/56521798565787

**API Reference**

- Agent Status API - https://support.kixie.com/hc/en-us/articles/360020051474
- Business/Team SMS API - https://support.kixie.com/hc/en-us/articles/19171653389339
- Kixie API Authentication: Your API Key and Business ID - https://support.kixie.com/hc/en-us/articles/7273987300635
- Make a Call API - https://support.kixie.com/hc/en-us/articles/19177004217243
- Send to Queue API - https://support.kixie.com/hc/en-us/articles/19199139766683

**Webhooks**

- 'Schedule Activity' Webhook Configuration & Data Payload - https://support.kixie.com/hc/en-us/articles/18235583591835
- 'Start Call' Webhook Configuration and Data Payload - https://support.kixie.com/hc/en-us/articles/18238875912347
- 'Voicemail' Webhook Configuration and Data Payload - https://support.kixie.com/hc/en-us/articles/18237786127643
- Call Outcome Webhook - Configuration and Data Payload - https://support.kixie.com/hc/en-us/articles/18238735604379
- Kixie Webhooks (And How to Log Calls & SMS in non-native CRMs?) - https://support.kixie.com/hc/en-us/articles/115001522614
- Managing Kixie Event Webhooks via API - https://support.kixie.com/hc/en-us/articles/20871662051739

**Kixie Dashboard Updates**

- Kixie Dashboard Update - Feb 16th, 2023 - https://support.kixie.com/hc/en-us/articles/15137207678747
- Kixie Dashboard Update - January 18th, 2023 - https://support.kixie.com/hc/en-us/articles/12104824408347
- Kixie Dashboard Update - May 9th, 2023 - https://support.kixie.com/hc/en-us/articles/15050187412379
- Kixie Dashboard Update - New Add Agent Workflow, Live Queues, and more! - https://support.kixie.com/hc/en-us/articles/4450774171547
- Kixie Dashboard and PowerCall Update – February 13th, 2025 - https://support.kixie.com/hc/en-us/articles/34015932071323
- Kixie Product Update - July 15th, 2024 - https://support.kixie.com/hc/en-us/articles/27331947335195
- Kixie Product Update - May 30th, 2024 - https://support.kixie.com/hc/en-us/articles/25597595290907
- Kixie Product Update - September 23rd, 2024 - https://support.kixie.com/hc/en-us/articles/28280286912795

### PhoneBurner (205 articles)


**Dialing**

- Call Transcription with AI Note Taker (Premium Accounts) - https://support.phoneburner.com/hc/en-us/articles/28212233001492
- Can I change how long the system waits for an answer? - https://support.phoneburner.com/hc/en-us/articles/115005867966
- Can I control what area codes are blocked or allowed? - https://support.phoneburner.com/hc/en-us/articles/115005755846
- Can I leave a live voicemail? - https://support.phoneburner.com/hc/en-us/articles/360047583871
- Can I turn off ringing while in a Dial Session? - https://support.phoneburner.com/hc/en-us/articles/115005074806
- Can I use Magic Jack to dial? - https://support.phoneburner.com/hc/en-us/articles/360000072826
- Click to Call Caller ID - https://support.phoneburner.com/hc/en-us/articles/47847432055444
- Click to Call and Inbound Notes - https://support.phoneburner.com/hc/en-us/articles/47847307909012
- Click to Call from PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/35804213395348
- Click to Present - https://support.phoneburner.com/hc/en-us/articles/36444279760276
- Click-to-Call: Dial a number directly from a contact record - https://support.phoneburner.com/hc/en-us/articles/28085959996180
- Connect Score Deep Dive - https://support.phoneburner.com/hc/en-us/articles/40746440876436
- Creating a Phone Script - https://support.phoneburner.com/hc/en-us/articles/36826876856468
- Dialer Presets - https://support.phoneburner.com/hc/en-us/articles/360043378732
- Does call recording stay on when using Call Transfer? - https://support.phoneburner.com/hc/en-us/articles/360018741912
- Enhanced Click to Call in PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/36444505941396
- Help with troubleshooting microphone issues with Softphone - https://support.phoneburner.com/hc/en-us/articles/360023104831
- How can I pause before each call instead of dialing the next call ? (Dialer Pause and Preview feature) - https://support.phoneburner.com/hc/en-us/articles/360049313692
- How can I test my connection? - https://support.phoneburner.com/hc/en-us/articles/360017811651
- How do I change my settings to limit area codes? - https://support.phoneburner.com/hc/en-us/articles/360000053166
- How do I disposition a live answer call? - https://support.phoneburner.com/hc/en-us/articles/360000483603
- How do I finish or resume a Dial Session I have already started? - https://support.phoneburner.com/hc/en-us/articles/360000516743
- How do I record a voicemail? - https://support.phoneburner.com/hc/en-us/articles/115005284946
- How do I start a Dial Session? (Dialing FAQ) - https://support.phoneburner.com/hc/en-us/articles/115004996246
- How is the Caller ID (CID) phone number and name determined? - https://support.phoneburner.com/hc/en-us/articles/115005671026
- How to change my Call Transfer settings? - https://support.phoneburner.com/hc/en-us/articles/115004988323
- How to change my Click to Present settings? - https://support.phoneburner.com/hc/en-us/articles/360000050983
- How to change my ConnectMe settings? - https://support.phoneburner.com/hc/en-us/articles/360000053326
- Live Answer Rate FAQ - https://support.phoneburner.com/hc/en-us/articles/5546775314452
- PhoneBurner Call Transcription Overview - https://support.phoneburner.com/hc/en-us/articles/35802813000852
- PhoneBurner Call Transfer | How to Set Up & Use - https://support.phoneburner.com/hc/en-us/articles/36826426640532
- PhoneBurner Settings:General - https://support.phoneburner.com/hc/en-us/articles/360001155226
- QuickStart Start Dialing - https://support.phoneburner.com/hc/en-us/articles/36410902719252
- Using PhoneBurner on an iPad - https://support.phoneburner.com/hc/en-us/articles/360048212331
- Verified Caller ID Library - https://support.phoneburner.com/hc/en-us/articles/115005028846
- What are Dispositions and how do I change my Disposition settings? - https://support.phoneburner.com/hc/en-us/articles/115005890643
- What are the system requirements to use PhoneBurner? - https://support.phoneburner.com/hc/en-us/articles/360033251192
- What are the telemarketing calling hours information? - https://support.phoneburner.com/hc/en-us/articles/115005668723
- What happens when my Free Trial Account runs out of minutes? - https://support.phoneburner.com/hc/en-us/articles/115005967626
- What information does Technical Support need to troubleshoot Dial Session problems? - https://support.phoneburner.com/hc/en-us/articles/360000331066
- What is a Phone Script? - https://support.phoneburner.com/hc/en-us/articles/360000256046
- What is the Caller ID verification policy? - https://support.phoneburner.com/hc/en-us/articles/360038069552
- Why am I see the error message 'System Requirements: Port 443'? - https://support.phoneburner.com/hc/en-us/articles/115005923786
- Why am I seeing 'dialer is in use' message? - https://support.phoneburner.com/hc/en-us/articles/360016469512
- Why am I seeing the message the connection to your current call has been terminated? - https://support.phoneburner.com/hc/en-us/articles/360031289791
- Why are all my buttons greyed out? - https://support.phoneburner.com/hc/en-us/articles/360042572712
- Why are my voicemails not being left? - https://support.phoneburner.com/hc/en-us/articles/360000318383
- Why are there restrictions on dialing times? - https://support.phoneburner.com/hc/en-us/articles/360015673251
- Why can't I see Disposition Buttons? - https://support.phoneburner.com/hc/en-us/articles/115005029306
- Why can't I select a button that is greyed out? - https://support.phoneburner.com/hc/en-us/articles/360000687563
- Why can't I select buttons after my call? - https://support.phoneburner.com/hc/en-us/articles/360000482126
- Why can't some contacts hear me? - https://support.phoneburner.com/hc/en-us/articles/360032404972
- Why did I get logged out of PhoneBurner ? - https://support.phoneburner.com/hc/en-us/articles/360029364251
- Why does my Caller ID show up as a Russian or International Number? - https://support.phoneburner.com/hc/en-us/articles/360053056132
- Why is my talk time not showing? - https://support.phoneburner.com/hc/en-us/articles/360000318603
- iOS 17 Live Voicemail FAQs - https://support.phoneburner.com/hc/en-us/articles/18279489419668

**Numbers**

- ARMOR Call Volume - https://support.phoneburner.com/hc/en-us/articles/41107534689684
- ARMOR Connect Score Pie Chart - https://support.phoneburner.com/hc/en-us/articles/41111402032276
- ARMOR® - #1 Solution for Spam Flags & Answer Rates - https://support.phoneburner.com/hc/en-us/articles/27428244700180
- ARMOR® Filters - https://support.phoneburner.com/hc/en-us/articles/35517371956372
- ARMOR® Flagged Numbers - https://support.phoneburner.com/hc/en-us/articles/36445615090452
- ARMOR® Overview and Accessing the ARMOR® Dashboard - https://support.phoneburner.com/hc/en-us/articles/35517478601364
- Bring Your Own Caller ID to PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/35521456256148
- Buying a Number through PhoneBurner for your Caller ID - https://support.phoneburner.com/hc/en-us/articles/35521266900628
- Call Flows - https://support.phoneburner.com/hc/en-us/articles/37030906845972
- Call Groups - https://support.phoneburner.com/hc/en-us/articles/37030672385044
- Call Groups vs Call Flows - https://support.phoneburner.com/hc/en-us/articles/37030314985108
- Create a number pool that routes to “Call Flow” - https://support.phoneburner.com/hc/en-us/articles/35517919132820
- Create a number pool that routes to “Call Group” - https://support.phoneburner.com/hc/en-us/articles/35517740017172
- Create a number pool that routes to “External Number” - https://support.phoneburner.com/hc/en-us/articles/35517841614356
- Create a number pool that routes to “Last Caller” - https://support.phoneburner.com/hc/en-us/articles/35518035314580
- Create a number pool that routes to “Team Member” - https://support.phoneburner.com/hc/en-us/articles/35518115341204
- How to create Number Pools Dialer Presets - https://support.phoneburner.com/hc/en-us/articles/16380510221588
- How to create and organize Number Pools - https://support.phoneburner.com/hc/en-us/articles/16380127494804
- Improve Trust & Call Reputation with CNAM - https://support.phoneburner.com/hc/en-us/articles/36151978041620
- Inbound Call Routing to Your PhoneBurner Account - https://support.phoneburner.com/hc/en-us/articles/37029684737428
- Managing your Number Pools Edit and add remove numbers from pool - https://support.phoneburner.com/hc/en-us/articles/35517639865620
- Number Pool Number Rotation Random VS  Local Presence, Activate Local Presence - https://support.phoneburner.com/hc/en-us/articles/35518183347348
- Number Pool Overview - https://support.phoneburner.com/hc/en-us/articles/35521204609684
- Number Pools - https://support.phoneburner.com/hc/en-us/articles/11303474714772
- Number Pools Frequently Asked Questions - https://support.phoneburner.com/hc/en-us/articles/16380284125844
- PhoneBurner Branded Caller ID - https://support.phoneburner.com/hc/en-us/articles/29113192674068
- Why New Phone Numbers Get Flagged as Spam (and What to Do About It) - https://support.phoneburner.com/hc/en-us/articles/45379065808788
- Why are my numbers no longer automatically matching my contact’s area codes? - https://support.phoneburner.com/hc/en-us/articles/115005514966
- Why was I assigned a different area code than the one I ordered? - https://support.phoneburner.com/hc/en-us/articles/360046278691

**Local Presence**

- Activate Local Presence - https://support.phoneburner.com/hc/en-us/articles/36410692890516
- How do I apply for Local Presence? - https://support.phoneburner.com/hc/en-us/articles/16316754256276
- Local Presence - https://support.phoneburner.com/hc/en-us/articles/16316515469716

**Trust and Safety**

- A Guide to STIR/SHAKEN - https://support.phoneburner.com/hc/en-us/articles/360061186971
- Compliant SMS: Registering for A2P 10DLC via The Campaign Registry™ - https://support.phoneburner.com/hc/en-us/articles/14693916814100
- How do I complete a Business Verification Form as an individual/sole proprietor? - https://support.phoneburner.com/hc/en-us/articles/4406891066516
- My SMS Compliance Review is Underway. Now What? - https://support.phoneburner.com/hc/en-us/articles/14239554256404
- PhoneBurner Compliance FAQs - https://support.phoneburner.com/hc/en-us/articles/360061955111
- PhoneBurner’s Acceptable Use Policy for SMS Messaging - https://support.phoneburner.com/hc/en-us/articles/13237103186196
- Prohibited Messaging Practices and Campaign Content - https://support.phoneburner.com/hc/en-us/articles/14696988624404
- Reduce the likelihood of spam/scam flags on your calls - https://support.phoneburner.com/hc/en-us/articles/360054041772
- SMS Sample Terms of Service - https://support.phoneburner.com/hc/en-us/articles/30247791197076
- Text Messaging Approval Checklist - https://support.phoneburner.com/hc/en-us/articles/19713988731540
- Tips for completing the PhoneBurner Business Verification Form - https://support.phoneburner.com/hc/en-us/articles/15329792964756
- What is a Do Not Call policy? - https://support.phoneburner.com/hc/en-us/articles/37413898203540
- Why was my Business Verification Form rejected? - https://support.phoneburner.com/hc/en-us/articles/4406909260436

**Team Accounts**

- Connect Score Reporting - https://support.phoneburner.com/hc/en-us/articles/41076081668116
- Custom Report   Activity Report - https://support.phoneburner.com/hc/en-us/articles/41058566678036
- Custom Report   Funnel Report - https://support.phoneburner.com/hc/en-us/articles/41058462705556
- Custom Report   Member Detail - https://support.phoneburner.com/hc/en-us/articles/41060844011668
- Custom Report   Real Time Leaderboard - https://support.phoneburner.com/hc/en-us/articles/41060676841492
- Custom Report   Source Report - https://support.phoneburner.com/hc/en-us/articles/41059135567252
- Custom Report   Team Summary - https://support.phoneburner.com/hc/en-us/articles/41059038898580
- How to Create a Custom Report - https://support.phoneburner.com/hc/en-us/articles/360018337632
- New Supervisor Role for PhoneBurner Users - https://support.phoneburner.com/hc/en-us/articles/39766295689748
- Standard Report   Connection Rate - https://support.phoneburner.com/hc/en-us/articles/41058961154452
- Standard Report   Dial Sessions - https://support.phoneburner.com/hc/en-us/articles/41058813529492
- Standard Report   Disposition Summary - https://support.phoneburner.com/hc/en-us/articles/41058364550036
- Standard Report   Leads by Source - https://support.phoneburner.com/hc/en-us/articles/41058704427924
- Standard Report   SMS Usage - https://support.phoneburner.com/hc/en-us/articles/41058644721172
- Standard Reports and Where We Get the Stats - https://support.phoneburner.com/hc/en-us/articles/6528816426004
- What is Temporary Contact Sharing? - https://support.phoneburner.com/hc/en-us/articles/16722653898388

**LeadStream**

- All the Ways you can add Leads to Your LeadStreams - https://support.phoneburner.com/hc/en-us/articles/39586250398996
- How can I distribute leads using LeadStream? - https://support.phoneburner.com/hc/en-us/articles/115005507883
- LeadBlitz Hot and Fresh Leads - https://support.phoneburner.com/hc/en-us/articles/39565136547092
- LeadStream Types Overview - https://support.phoneburner.com/hc/en-us/articles/39564738547988
- What is LeadStream? - https://support.phoneburner.com/hc/en-us/articles/115005515126

**SMS**

- Best Practices for SMS - https://support.phoneburner.com/hc/en-us/articles/4404576742804
- How is SMS / text messaging usage monitored and billed? - https://support.phoneburner.com/hc/en-us/articles/360058128411
- Maximizing SMS Deliverability with Templates - https://support.phoneburner.com/hc/en-us/articles/27272124764436
- SMS Application FAQ - https://support.phoneburner.com/hc/en-us/articles/37916948059284
- SMS Registration & $50 Application Fee – What You Need to Know - https://support.phoneburner.com/hc/en-us/articles/37916865941908
- SMS Usage & Guidelines - https://support.phoneburner.com/hc/en-us/articles/360046340251
- Send SMS text messages based on a disposition - https://support.phoneburner.com/hc/en-us/articles/4418739233044
- Send a custom SMS while in a dial session - https://support.phoneburner.com/hc/en-us/articles/4418731887508
- Sending SMS and SMS FAQ - https://support.phoneburner.com/hc/en-us/articles/4418739274388
- Sending SMS messages from Contact record - https://support.phoneburner.com/hc/en-us/articles/4418253472148
- Why SMS Messages Get Marked as Spam and What You Can Do About It - https://support.phoneburner.com/hc/en-us/articles/13889907996692

**Inbound**

- Accepting Inbound (Premium) - https://support.phoneburner.com/hc/en-us/articles/35517094235796
- Answer incoming calls within PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/28277278463636
- Call Forwarding Personal Inbound Routing - https://support.phoneburner.com/hc/en-us/articles/35517239010452
- Click to Call and Inbound Notes - https://support.phoneburner.com/hc/en-us/articles/47847291333524
- Inbound Call History and Voicemail - https://support.phoneburner.com/hc/en-us/articles/35516849211668
- Inbound in the Dialer (Premium) - https://support.phoneburner.com/hc/en-us/articles/35517191861268
- Set up inbound routing for incoming calls - https://support.phoneburner.com/hc/en-us/articles/31263283262484
- Taking inbound calls in PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/35804074187028

**ARMOR®**

- ARMOR Call Volume - https://support.phoneburner.com/hc/en-us/articles/41107492182420
- ARMOR Connect Score Pie Chart - https://support.phoneburner.com/hc/en-us/articles/41111346883860
- ARMOR® Frequently Asked Questions - https://support.phoneburner.com/hc/en-us/articles/37415132398356
- Best Practices to Minimize Flags - https://support.phoneburner.com/hc/en-us/articles/40077903608724
- Getting Started with ARMOR® and Dialing Best Practices - https://support.phoneburner.com/hc/en-us/articles/29805245918356
- My Number is Flagged–Now What? - https://support.phoneburner.com/hc/en-us/articles/40077700510996
- Spam Flags & Negative Reputation, Explained - https://support.phoneburner.com/hc/en-us/articles/40077460509588
- Using ARMOR® Performance Dashboard to Diagnose Problems & Reduce Flags - https://support.phoneburner.com/hc/en-us/articles/40368805179412
- Using ARMOR® Performance Dashboard to be More Successful - https://support.phoneburner.com/hc/en-us/articles/40368474993940

**Account Settings**

- Are Canadian Area code numbers available for purchase? - https://support.phoneburner.com/hc/en-us/articles/360046683631
- Can I recover a deleted voicemail? - https://support.phoneburner.com/hc/en-us/articles/360000017586
- Create/edit dialing set [Video] - https://support.phoneburner.com/hc/en-us/articles/360043674832
- Create/edit live answer set [Video] - https://support.phoneburner.com/hc/en-us/articles/360043674872
- Default Admin Team Page - Live Calls - https://support.phoneburner.com/hc/en-us/articles/360059805911
- Disposition buttons overview [Video] - https://support.phoneburner.com/hc/en-us/articles/360042150072
- How do I sync PhoneBurner with my Google calendar? - https://support.phoneburner.com/hc/en-us/articles/115005897043
- How do I turn on Call Recording? - https://support.phoneburner.com/hc/en-us/articles/115005941146
- How do I view my call recordings? - https://support.phoneburner.com/hc/en-us/articles/360016580591
- How to change your email and notification preferences - https://support.phoneburner.com/hc/en-us/articles/115005872886
- How to save and edit Quick Links? - https://support.phoneburner.com/hc/en-us/articles/360018472952
- How to set up a Call Flow - https://support.phoneburner.com/hc/en-us/articles/24535691066900
- How to set up a Call Group - https://support.phoneburner.com/hc/en-us/articles/24536074902548
- Two-Factor Authentication - https://support.phoneburner.com/hc/en-us/articles/360058823851
- What are approved PhoneBurner IP addresses and ranges? - https://support.phoneburner.com/hc/en-us/articles/360000421346
- Why is my account locked due to too many attempts? - https://support.phoneburner.com/hc/en-us/articles/360000130486

**PhoneBunner API**

- Generate a Personal Access Token PAT - https://support.phoneburner.com/hc/en-us/articles/36826752283028
- How do I get an API token that grants access to all info across all accounts on a team? - https://support.phoneburner.com/hc/en-us/articles/4402900881812
- Phoneburner API: Email Ok codes - https://support.phoneburner.com/hc/en-us/articles/4402410635668
- What is API information-Client Id and where does it come from? - https://support.phoneburner.com/hc/en-us/articles/360022984112

**Webhooks**

- Call Begin Webhook - https://support.phoneburner.com/hc/en-us/articles/39011468714260
- Call End/Done Webhook - https://support.phoneburner.com/hc/en-us/articles/39011166673556
- Call End/Done Webhook Disposition - https://support.phoneburner.com/hc/en-us/articles/39011331286420
- Contact Activity Webhooks in PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/39835730484500
- Dial Session Contact Displayed Webhook - https://support.phoneburner.com/hc/en-us/articles/38939703296020
- Email Unsubscribe Webhook - https://support.phoneburner.com/hc/en-us/articles/39011410416532
- How do I add my webhooks to an integration? - https://support.phoneburner.com/hc/en-us/articles/360027923492
- Manual Webhook - https://support.phoneburner.com/hc/en-us/articles/39011180107796
- Multiple Call End Webhooks in PhoneBurner - https://support.phoneburner.com/hc/en-us/articles/38939647316372
- SMS Opt Out Webhook - https://support.phoneburner.com/hc/en-us/articles/39011246762132

**Quickstart Training and Other FAQ's**

- QuickStart 2024 Intro - https://support.phoneburner.com/hc/en-us/articles/36410986403988
- QuickStart Caller ID Options - https://support.phoneburner.com/hc/en-us/articles/36411331967764
- QuickStart Dispositions - https://support.phoneburner.com/hc/en-us/articles/36411241058068
- Record Your Outgoing Voicemail QuickStart - https://support.phoneburner.com/hc/en-us/articles/36411165416084
- What's New in PhoneBurner (Summer 2026) — Product Update - https://support.phoneburner.com/hc/en-us/articles/51757177595156

**Contact Management**

- 3 Saved Searches to simplify your Daily Process - https://support.phoneburner.com/hc/en-us/articles/38051077863444
- Today's Follow Up's Saved Search and Layout - https://support.phoneburner.com/hc/en-us/articles/38050939926804
- Shared Saved Searches for team - https://support.phoneburner.com/hc/en-us/articles/38050130775572
- Preparing your file to be imported - https://support.phoneburner.com/hc/en-us/articles/37097345280532
- QuickStart Importing your Contacts - https://support.phoneburner.com/hc/en-us/articles/36410802053652
- Where are my "New Contacts"? How to Pin a Saved Search  or folder to Quick Views. - https://support.phoneburner.com/hc/en-us/articles/360048861611
- How to import contacts [Video] - https://support.phoneburner.com/hc/en-us/articles/360043674912
- How to keep the same order of my contacts between the Import file and Contacts Manager - https://support.phoneburner.com/hc/en-us/articles/360029132052
- How can I split text into columns in spreadsheets for imports when names or other data is put together? - https://support.phoneburner.com/hc/en-us/articles/360029364091
- How are time zone v. local time v. allowed dial times calculated? - https://support.phoneburner.com/hc/en-us/articles/360028713831
- How do I import contacts? - https://support.phoneburner.com/hc/en-us/articles/360019870812
- Can I merge duplicate contacts in my account? - https://support.phoneburner.com/hc/en-us/articles/360001203883
- How do I convert my spreadsheet to a CSV for importing without Excel? - https://support.phoneburner.com/hc/en-us/articles/360000891946
- How many contacts can I import? - https://support.phoneburner.com/hc/en-us/articles/360000428603
- How can I move contacts from one folder to another after import? - https://support.phoneburner.com/hc/en-us/articles/360000344483
- How do I use Advanced Search and Saved Search? - https://support.phoneburner.com/hc/en-us/articles/360000344403
- How Do I Export Contacts/Dial Sessions out of PhoneBurner? - https://support.phoneburner.com/hc/en-us/articles/360000344383
- How do I scrub my data to the National Do Not Call List (DNC)? - https://support.phoneburner.com/hc/en-us/articles/360000255703
- How do I to set up a CSV file for importing? - https://support.phoneburner.com/hc/en-us/articles/115005482446
- How can I see if someone is on my DNC list or add entries? - https://support.phoneburner.com/hc/en-us/articles/115005070583

### JustCall Sales Dialer (57 articles)


**Getting started & plans**

- FAQs: Sales Dialer - https://help.justcall.io/en/articles/8492573-faqs-sales-dialer
- Sales Dialer 101: What It Is & How It Works - https://help.justcall.io/en/articles/10825775-sales-dialer-101-what-it-is-how-it-works
- Sales Dialer: Subscription Plans & Free Trial Guide - https://help.justcall.io/en/articles/10947950-sales-dialer-subscription-plans-free-trial-guide
- Understanding Sales Dialer Trial and Plans - https://help.justcall.io/en/articles/9895178-understanding-sales-dialer-trial-and-plans

**Campaigns & dialing modes**

- Allowing Duplicate Contacts in Sales Dialer through CSV - https://help.justcall.io/en/articles/9831777-allowing-duplicate-contacts-in-sales-dialer-through-csv
- Alternate Number Dialing in Sales Dialer - https://help.justcall.io/en/articles/9794932-alternate-number-dialing-in-sales-dialer
- Choosing the Right Sales Dialer Campaign - https://help.justcall.io/en/articles/10520971-choosing-the-right-sales-dialer-campaign
- Creating a Campaign from a CSV File in Sales Dialer - https://help.justcall.io/en/articles/9916769-creating-a-campaign-from-a-csv-file-in-sales-dialer
- Dropdown Custom Fields - https://help.justcall.io/en/articles/6976943-dropdown-custom-fields
- How To Manage Your Sales Dialer Campaigns - https://help.justcall.io/en/articles/12054100-how-to-manage-your-sales-dialer-campaigns
- How to Add Contacts to a Sales Dialer Campaign - https://help.justcall.io/en/articles/10539955-how-to-add-contacts-to-a-sales-dialer-campaign
- How to Create a Sales Dialer Campaign - https://help.justcall.io/en/articles/10510795-how-to-create-a-sales-dialer-campaign
- How to re-run a Sales Dialer Campaign? - https://help.justcall.io/en/articles/5299073-how-to-re-run-a-sales-dialer-campaign
- How to resolve issues while uploading CSV file in the Autodialer Campaign - https://help.justcall.io/en/articles/3947148-how-to-resolve-issues-while-uploading-csv-file-in-the-autodialer-campaign
- Mandatory Country Code for the Sales Dialer Campaign - https://help.justcall.io/en/articles/9182737-mandatory-country-code-for-the-sales-dialer-campaign
- Pause an ongoing Sales Dialer Campaign - https://help.justcall.io/en/articles/2282383-pause-an-ongoing-sales-dialer-campaign
- Predictive Dialer Campaign Settings - https://help.justcall.io/en/articles/9099715-predictive-dialer-campaign-settings
- Reasons for Auto and Predictive Dialer Campaign Ending - https://help.justcall.io/en/articles/8707380-reasons-for-auto-and-predictive-dialer-campaign-ending
- Resume a Sales Dialer Campaign. - https://help.justcall.io/en/articles/2282407-resume-a-sales-dialer-campaign
- Simultaneous Calls in Predictive Dialer - https://help.justcall.io/en/articles/8707391-simultaneous-calls-in-predictive-dialer
- Understanding Answering Machine Screening in Predictive Dialer - https://help.justcall.io/en/articles/8559982-understanding-answering-machine-screening-in-predictive-dialer
- Waiting screen in the dynamic dialer - https://help.justcall.io/en/articles/8707233-waiting-screen-in-the-dynamic-dialer
- What is Dynamic Dialer? - https://help.justcall.io/en/articles/9914511-what-is-dynamic-dialer

**Retry, scheduling & calling hours**

- Calling Hours in Sales Dialer - https://help.justcall.io/en/articles/10501459-calling-hours-in-sales-dialer
- Sales Dialer Reattempt Rules: A Quick Guide - https://help.justcall.io/en/articles/11274938-sales-dialer-reattempt-rules-a-quick-guide
- Schedule Call Back section in Sales Dialer - https://help.justcall.io/en/articles/6725677-schedule-call-back-section-in-sales-dialer
- Scheduled Calls in Sales Dialer Campaigns - https://help.justcall.io/en/articles/5959137-scheduled-calls-in-sales-dialer-campaigns
- Setting Priorities for Reattempt Rules and New Leads in Campaigns - https://help.justcall.io/en/articles/9324024-setting-priorities-for-reattempt-rules-and-new-leads-in-campaigns

**Voicemail & AMD**

- Auto-Classify Pickups in Sales Dialer: Automatically Classify Calls as Human or Machine Answered - https://help.justcall.io/en/articles/12097719-auto-classify-pickups-in-sales-dialer-automatically-classify-calls-as-human-or-machine-answered
- Drop Voicemail to contact in Sales Dialer Campaign - https://help.justcall.io/en/articles/2285649-drop-voicemail-to-contact-in-sales-dialer-campaign
- Upload Voicemail in Sales Dialer Campaign - https://help.justcall.io/en/articles/2284979-upload-voicemail-in-sales-dialer-campaign

**Numbers, caller ID & inbound**

- Allow Incoming Calls While Busy in Sales Dialer - https://help.justcall.io/en/articles/16341198-allow-incoming-calls-while-busy-in-sales-dialer
- Best Practices to Avoid Spam Flags on Sales Dialer Numbers - https://help.justcall.io/en/articles/11100352-best-practices-to-avoid-spam-flags-on-sales-dialer-numbers
- Forward incoming calls in Sales Dialer - https://help.justcall.io/en/articles/2285632-forward-incoming-calls-in-sales-dialer
- Introducing Custom Local Number Bundles - https://help.justcall.io/en/articles/12959562-introducing-custom-local-number-bundles
- Local Presence in Sales Dialer - https://help.justcall.io/en/articles/7851731-local-presence-in-sales-dialer
- Managing Number Health and Improving Connect Rates in Sales Dialer - https://help.justcall.io/en/articles/13267836-managing-number-health-and-improving-connect-rates-in-sales-dialer
- Number Privacy in Sales Dialer - https://help.justcall.io/en/articles/5966264-number-privacy-in-sales-dialer
- Separate number for Sales Dialer - https://help.justcall.io/en/articles/2282341-separate-number-for-sales-dialer
- Transfer All Incoming Calls to One Number in Sales Dialer - https://help.justcall.io/en/articles/5966673-transfer-all-incoming-calls-to-one-number-in-sales-dialer

**Dispositions, scripts & workflows**

- Advanced Workflows in Sales Dialer - https://help.justcall.io/en/articles/5966213-advanced-workflows-in-sales-dialer
- Define Success of Calls in Sales Dialer Campaign - https://help.justcall.io/en/articles/2282298-define-success-of-calls-in-sales-dialer-campaign
- Group Disposition in Sales Dialer - https://help.justcall.io/en/articles/5917202-group-disposition-in-sales-dialer
- How to send email through workflows in Sales Dialer? - https://help.justcall.io/en/articles/6465785-how-to-send-email-through-workflows-in-sales-dialer
- Sales Dialer: Make Disposition Selection Mandatory on the After-call work screen - https://help.justcall.io/en/articles/6815820-sales-dialer-make-disposition-selection-mandatory-on-the-after-call-work-screen
- Sales Dialer: Skip Call Outcome Screen - https://help.justcall.io/en/articles/6815549-sales-dialer-skip-call-outcome-screen
- Sales Script in Sales Dialer - https://help.justcall.io/en/articles/5302895-sales-script-in-sales-dialer
- Setting Up AI Voice Agent to handle callbacks from Sales Dialer Campaigns - https://help.justcall.io/en/articles/10264613-setting-up-ai-voice-agent-to-handle-callbacks-from-sales-dialer-campaigns
- Workflows in Sales Dialer - https://help.justcall.io/en/articles/11568864-workflows-in-sales-dialer

**Settings, analytics, permissions & apps**

- Analyse your JustCall Sales Dialer Campaign - https://help.justcall.io/en/articles/2282428-analyse-your-justcall-sales-dialer-campaign
- Roles and Permissions for Sales Dialer - https://help.justcall.io/en/articles/15450992-roles-and-permissions-for-sales-dialer
- Sales Dialer Account Settings Explained - https://help.justcall.io/en/articles/11065197-sales-dialer-account-settings-explained
- Sales Dialer Call Analytics Metrics Glossary - https://help.justcall.io/en/articles/13406869-sales-dialer-call-analytics-metrics-glossary
- Sales Dialer Dashboard Overview - https://help.justcall.io/en/articles/2285760-sales-dialer-dashboard-overview
- Sales Dialer Mobile App for Android - https://help.justcall.io/en/articles/11756724-sales-dialer-mobile-app-for-android
- Sales Dialer Mobile App for iOS - https://help.justcall.io/en/articles/10373912-sales-dialer-mobile-app-for-ios
- Sales Dialer: Agent Analytics Dashboard - https://help.justcall.io/en/articles/6740471-sales-dialer-agent-analytics-dashboard

## Appendix C. Sources

- https://www.kixie.com/powerdialer
- https://www.kixie.com/pricing
- https://support.kixie.com/hc/en-us
- https://www.phoneburner.com/features
- https://www.phoneburner.com/pricing
- https://support.phoneburner.com/hc/en-us
- https://help.justcall.io/en/
- https://help.justcall.io/en/collections/308523-sales-dialer
- https://justcall.io/product/auto-dialer/
- https://www.kixie.com/sales-blog/best-affordable-power-dialers/ (vendor-authored comparison)
- https://www.mrrnerds.com/compare/kixie-vs-phoneburner (third party)
- https://www.dialsheet.io/resources/kixie-vs-phoneburner (third party)
- https://www.capterra.com/p/135636/Kixie-PowerCall/
- https://www.capterra.com/p/134672/PhoneBurner/
- https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection
- https://developers.telnyx.com/api-reference/callbacks/call-machine-premium-greeting-ended
- https://apispec.telnyx.com/dial-17988585e0
- https://www.twilio.com/docs/voice/answering-machine-detection
- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310/section-310.4
- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310
