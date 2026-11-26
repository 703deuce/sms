# AI receptionist competitors vs AgentLab phone

Research date: **25 Nov 2026, America/New_York**. Sources are official product, pricing, docs and feature pages (plus two Rosie FAQ/review pages that quote the official pricing FAQ). No hands-on trials. No code was changed for this write-up.

AgentLab baseline is what is actually in `/workspace/agentlab_phone/ARCHITECTURE.md` and `/workspace/agentlab_phone/src` (worker, `phone` CLI, `store.DEFAULT_CONFIG`) as of this date: GPT Live front end (~5¢/min) + Luna tools, message-taking live, live Microsoft booking and transfers built but not fully proven, SMS built but off, connectors built but waiting on sign-in.

Legend: **Have** = shipped and usable now. **Partial** = designed or coded, but incomplete, untested, or off by default. **Missing** = not in the current phone agent.

---

## 1. Competitor snapshots

### Rosie AI ([heyrosie.com](https://heyrosie.com/), [pricing](https://heyrosie.com/pricing), [overflow](https://heyrosie.com/solutions/overflow-answering-service), [direct booking](https://heyrosie.com/blog/rosie-can-book-appointments-directly-into-your-calendar), [llms.txt](https://heyrosie.com/llms.txt))

Built for US small businesses, especially home services. You keep your number and **forward** calls: all the time, after hours only, or overflow (busy / no-answer) via conditional forwarding.

- **Modes:** 24/7, after-hours, overflow. Multiple calls at once. Separate after-hours greeting.
- **Messages:** Custom “smart” message-taking scenarios by reason for the call (2 / 5 / unlimited by plan).
- **Booking:** Professional plan texts a scheduling link. Scale+ books live into **Google Calendar, Calendly, Acuity, Appointlet**. Outlook is not listed.
- **Transfers:** Scale: warm (briefs the team first) and live/instant. Growth: **waterfall** (tries several numbers until someone answers).
- **SMS:** Appointment links by text on the base plan; mid-call texts to the caller on Scale+. Owner notified by email and/or text after every call.
- **Knowledge:** Auto-trained from the **website and Google Business Profile**; custom FAQs; Growth adds document upload.
- **CRM:** Zapier to 1,000+ apps, not a long list of native CRMs.
- **Spam:** Automatic spam / 1-800 / robocall filtering (all plans).
- **Delivery:** Summaries, transcripts, **recordings**; native iOS/Android apps; email and text notifications.
- **Languages / voice:** English and Spanish on every call; 10+ voices; custom name and greeting; pick an area code.
- **Hours:** Learns hours from GBP/website; after-hours greeting. Holiday calendar not called out as a first-class control.
- **Routing:** To a person or backup numbers; not a full PBX department router.
- **Payments / reporting:** No card collection advertised. Call inbox in the app; not a deep analytics suite.
- **Setup:** Paste site or GBP, review FAQs/greeting, test, then forward the number. 7-day free trial of all features.
- **Pricing:** Monthly minutes, rounded up to 60 seconds. Professional **$49 / 250 min**; Scale **$149 / 1,000**; Growth **$299 / 2,000**. Annual is two months free (~$41 / $124 / $249). No per-minute overage: exceeding the pool **auto-upgrades you to the next plan**. Website chat is free; website texting is a $50 add-on (25 conversations, then $1 each).

### Smith.ai — AI Receptionist and Hybrid ([AI product](https://smith.ai/ai-receptionist), [AI pricing](https://smith.ai/pricing/ai-receptionist), [hybrid pricing](https://smith.ai/pricing/hybrid-ai-human-receptionists), [after hours](https://smith.ai/features/after-hours-answering-service), [overflow](https://smith.ai/features/overflow-call-answering-service), [CRM](https://smith.ai/features/crm-zapier-integration), [Calendly](https://smith.ai/blog/ai-scheduling-with-smith-ai-calendly))

The distinctive pitch is **AI first, with a 24/7 North America live-agent network** you can escalate to. Strong in legal and other intake-heavy trades.

- **Modes:** 24/7. After-hours and overflow pages. Hybrid preset **“After Hours Only”**: live agents during business hours, AI after hours.
- **Messages / intake:** Custom playbooks, lead qualification by your criteria, matter-type screening. Quality Studio to test scenarios before going live.
- **Booking:** Calendly (live availability). Docs also mention Google Calendar and Microsoft 365 / Bookings. Confirmations and reminders by email or SMS.
- **Transfers:** Warm transfers with context to the customer’s team. Optional escalation to Smith live agents (AI-initiated escalation is free; owner-chosen live involvement is a per-call add-on).
- **SMS:** Call summaries, follow-ups, custom SMS branding on Pro+.
- **Knowledge / training:** Quality Studio goals and scenarios; custom prompting is an Enterprise feature. Not marketed as one-click website scrape the way Rosie/RingCentral are.
- **CRM:** Native **Clio, Salesforce, HubSpot**, plus Zapier/Make (5,000+).
- **Spam:** Blocks 20M+ known robocalls/solicitors (those do not count toward quota). Up to 10% of billed calls can be removed as spam each cycle. You can mark new spam.
- **Delivery:** Recording, transcription, structured summaries routed to the right people.
- **Languages:** English and Spanish, automatic detection.
- **Hours / routing:** After-hours coverage, overflow answering, call routing, multi-location on Enterprise.
- **Setup:** ~15 minutes, then Quality Studio (free plan: 25 real + 25 test + 50 simulated calls/month). Month-to-month, 30 days’ notice to cancel.
- **Pricing (per answered call, not per minute):** Free **$0 / 25 calls**. Pro from **$150 / 75 calls ($2.00)**; volume steps down to $1.80 / $1.67. Enterprise from **$500 / 300 calls ($1.67)**. Overage is higher ($3.00 on Free, $2.17–$2.50 on Pro). Hybrid starts ~**$2.50–$3.70/call** depending on preset. Human-first starts at **$7/call**.

### RingCentral AI Receptionist / AIR ([product](https://www.ringcentral.com/ai-receptionist.html), [pricing](https://www.ringcentral.com/pricing/ai-receptionist), [May 2026 blog](https://www.ringcentral.com/us/en/blog/ai-receptionist-texts-call-queues-integrations/), [Mar 2026 notes](https://support.ringcentral.com/release-notes/ai-receptionist/release-notes-march-2026.html))

Strongest **native overflow** because it can sit inside RingCentral call queues, not only behind carrier forwarding. Also the broadest language and compliance story.

- **Modes:** 24/7, after hours, custom schedules, overflow when the team is busy, and **queue destination** when the queue is full, max wait is hit, or no agent answers. Multiple calls at once. Unlimited AI Receptionists per plan.
- **Messages / intake:** Lead capture with custom questions; you can collect details right after the greeting, after FAQs, or just before a handoff.
- **Booking:** Google, Outlook, Calendly (book / reschedule / cancel). SMS booking links too.
- **Transfers:** Users, extensions, queues, or external numbers. Live handoff **with context**. Routing by name, location, or intent.
- **SMS:** AI SMS agent (extra charges may apply), follow-ups, inbound text handling 24/7. WhatsApp listed as coming soon.
- **Knowledge:** Auto-setup from the **website or Google Business Profile**; unlimited document uploads; “knowledge insights” on unanswered questions.
- **CRM:** Salesforce, Zoho, HubSpot. Shopify coming soon.
- **Spam:** Blocks spam (product page).
- **Delivery:** Transcripts, recordings, call analytics (volume, trends), knowledge-gap reports.
- **Languages:** English (US/UK/AU), French (CA/EU), Spanish (incl. Latin American), Italian, German, Portuguese; **automatic language switching**. 8 voices; custom greetings.
- **Hours:** Custom schedules and coverage, including holidays; multi-location hours and routing.
- **Payments:** Not offered; typical CCaaS terms avoid taking card data on the call.
- **Setup:** Guided, no professional services required. Keep your number or get a new local one. Works with any phone via forwarding or SIP; deepest when used with RingEX. 14-day trial.
- **Pricing:** Standalone **$49/mo for 100 minutes**, or **$39/mo** as a RingEX add-on (plus the RingEX seat, advertised from $30). Overage **$0.50/min**, billed in **30-second** increments. Minute bundles available. HIPAA and SOC 2 claimed.

### Also checked (lighter skim)

**Goodcall** ([pricing](https://www.goodcall.com/pricing), [how it works](https://www.goodcall.com/how-it-works)): 24/7 AI. Forward always, or only when busy / no answer. Hours **and holidays**. Custom intake questions, spelled back. Texts and emails the owner **during the call**. Google Calendar booking; leads to Google Sheets or HighLevel; API/MCP tools. Transfers with retry, then **waterfall up to three** contacts. Six voices. English only. Spam and wrong numbers are not billed. Setup: describe the business (site or PDF) to “Gabi,” run practice calls, then connect a number. Pricing is **per unique customer / month**, not per minute: **$79 / 100** (then 79¢), **$129 / 500** (26¢), **$299 / 2,000** (15¢). Free demo agent until you attach a number.

**Dialzara** ([pricing](https://dialzara.com/pricing), [features](https://dialzara.com/features)): 24/7 inbound AI, plus optional outbound, SMS agent, and website chat. Blind transfers on Lite; **warm transfers, after-hours rules, and Google/Outlook calendar** from Pro. Live availability with double-booking prevention, reschedule/cancel, reminders. Topic/priority routing, spam blocking, 10 languages with auto-detect, 50+ voices, recordings, email/SMS notifications, caller memory, free website chatbot. Knowledge-base uploads scale with the plan (third-party reviews of the pricing table: 5 / 10 / unlimited). 7-day trial, no contract. **$29 / 60 min** ($0.48 overage), **$99 / 220** ($0.45), **$199 / 500** ($0.40), **$349 / 1,000** ($0.35). Talk time billed **to the second**. If minutes hit zero and auto-recharge is off, callers go to voicemail. SMS agent is $19/mo + $0.05/message.

**My AI Front Desk / Frontdesk** ([product](https://www.myaifrontdesk.com/ai-receptionist), [integrations](https://www.myaifrontdesk.com/integrations)): Forward always, after hours, weekends, or when nobody picks up. Live booking on Google, Outlook, or Calendly; warm transfer of VIP/urgent callers; SMS confirmation to the caller and alert to the team. Trained from a pasted website plus FAQs, prices, service area, and tone. Built-in CRM plus HubSpot, Salesforce, Pipedrive, GoHighLevel, Zapier. Claims 20+ languages. **$99/mo** or **$79/mo** billed yearly, including **200 voice minutes**, chat, SMS (product page also cites 100 chatbot conversations and 400 texts), and CRM. Voice overage about **$0.25/min**. 7-day trial, no contract. No permanently free plan.

---

## 2. Feature matrix

| Feature | Rosie | Smith.ai | RingCentral AIR | Goodcall | Dialzara | My AI Front Desk | AgentLab now |
| --- | --- | --- | --- | --- | --- | --- | --- |
| After-hours mode | Have | Have | Have | Have | Have (Pro+) | Have | **Have** (`mode=after_hours`, weekly hours) |
| Overflow (busy / no-answer / queue) | Have (carrier forward) | Have | **Have (native queues)** | Have (forward) | Partial | Have (forward) | **Missing** as a first-class mode; a customer could still forward to our number |
| 24/7 / always-on | Have | Have | Have | Have | Have | Have | **Have** (`mode=always`) |
| Take a message / callback | Have (scenario packs) | Have (playbooks) | Have (custom intake) | Have (custom questions) | Have | Have | **Have** (name, callback, message, urgency) |
| Custom intake / qualification by call type | Have | Have | Have | Have | Have | Have | **Partial** (one generic script; `extra_instructions` only) |
| Live calendar booking | Scale+ (Google, Calendly, Acuity, Appointlet) | Calendly, Google, Bookings | Google, Outlook, Calendly | Google (API/MCP otherwise) | Pro+ Google/Outlook | Google, Outlook, Calendly | **Partial**: Microsoft Graph live book + holds is coded; Calendly connector exists; **neither signed in or proven**. No Google Calendar |
| Send booking link by SMS | Have (base plan) | Have | Have | Partial | Have | Have | **Partial** (tool exists; SMS off, 866 verification unconfirmed) |
| Book after the call via a backend agent | — | Human or CRM follow-up | CRM sync | Sheets / CRM | CRM | CRM | **Have** (AgentLab post-call run; unique strength) |
| Double-booking protection | Implied live free/busy | Live Calendly | Live calendars | Live Google | Have (advertised) | Live calendars | **Have** in code (atomic slot holds + re-check) |
| Cold / announced transfer | Have | Have | Have | Have | Have (all plans) | Have | **Partial**: one number, announced SIP bridge, fallback to a message. Transfer test was still in flight |
| Warm transfer (brief staff first) | Scale+ | Have | Have (handoff with context) | Partial (retry, then next) | Pro+ | Have | **Missing** (we do not whisper context to the owner before they pick up) |
| Waterfall / try-next numbers | Growth | Partial | Queues / multiple dest. | Have (up to 3) | Partial | Missing / unstated | **Missing** (single `transfer.number`) |
| Department / intent routing | Partial | Have | **Have** (users, extensions, queues) | Partial | Have | Partial | **Missing** (one dest., model-judged `when` rule) |
| Mid-call SMS to the caller | Scale+ | Have | Have | Have (owner alert mid-call) | Have | Have | **Partial** (confirmation / link tools; off) |
| Inbound SMS / chat / WhatsApp agent | Chat widget; texting add-on | Texts and live chat mentioned on after-hours page | SMS agent; WhatsApp soon | — | SMS + chat add-ons | Chat + SMS included | **Missing** inbound; outbound SMS only |
| Owner notified by email/SMS after the call | Have | Have | Have | Have (even mid-call) | Have | Have | **Partial**: AgentLab in-app notification + optional follow-ups. No default SMS/email to the owner |
| Transcript + summary | Have | Have | Have | Have | Have | Have | **Have** (Haiku summary, `phone calls` / bot Q&A) |
| Call recording (audio) | Have | Have | Have | Have | Have | Unstated / likely | **Missing** |
| FAQ / website / GBP training | Have | Partial (Quality Studio, Enterprise prompting) | Have | Have (site or PDF) | Have (uploads by plan) | Have | **Missing** (short `business_info` string only) |
| CRM write-back | Zapier | Native Clio, Salesforce, HubSpot | Salesforce, Zoho, HubSpot | Sheets, HighLevel, Zapier | Zapier/Make/API | Built-in + Salesforce, HubSpot, etc. | **Partial**: Salesforce & Zoho connectors built, not wired to auto-log a call |
| Spam / robocall filter | Have | Have (and spam doesn’t always bill) | Have | Have (not billed) | Have | Unstated | **Missing** |
| Multilingual | EN + ES | EN + ES auto | 10+ auto-switch | English only | 10 auto-detect | 20+ claimed | **Missing** (English only, not configured) |
| Custom voice / name / greeting | 10+ voices | Have | 8 voices | 6 voices | 50+ voices | Have | **Have** (6 GPT Live voices, custom name and greeting) |
| Business-hours rules | Have | Have | Have | Have | Pro+ | Have | **Have** (per-weekday windows + timezone) |
| Holiday / closure calendar | Partial (GBP hours) | Unstated | Have | **Have** | Mentions holidays | Mentions holidays | **Missing** |
| Payments on the call | No | No | No (avoided) | No | No | No | **Missing** (not table-stakes; skip for now) |
| Reporting / analytics | App inbox | AQI / Quality Studio | Volume, trends, knowledge gaps | Outcomes, tags | Activity log | CRM reports | **Partial** (per-call log, no dashboard) |
| Self-serve setup / wizard | Have (~minutes) | Have + Quality Studio | Have (website auto-setup) | Have (“Gabi” + practice calls) | Have (AI Configurator) | Have (~minutes) | **Partial**: chat/`phone set` is our wizard; no website scrape or owner-facing UI |
| Mobile app | iOS/Android | Unstated | Via RingEX | No | No | Unstated | **Missing** (AgentLab chat only) |
| Human backup network | No | **Have** (distinctive) | Your staff only | Your staff only | Your staff only | Your staff only | Your staff only (intentional) |
| Concurrent calls | Have | Have | Have | Have | Have | Have | **Partial** (LiveKit can; not load-tested) |
| Compliance (HIPAA / SOC 2) | “Data secure”; details thin | Encrypted storage | HIPAA + SOC 2 claimed | HIPAA claimed on some pages | Unstated on pricing | HIPAA/BAA claimed | **Missing** |

---

## 3. Pricing benchmarks (retail, USD, Nov 2026)

Wholesale cost for us is about **5¢/min** for GPT Live plus Luna tokens (a recent post-call bot answer was ~7s / $0.005). Retail AI receptionists charge a large markup on top of that.

| Vendor | Model | Starter | Typical small-business plan | Overage / notes |
| --- | --- | --- | --- | --- |
| Rosie | Monthly minutes (round up 60s) | $49 / 250 min (~20¢/min) | $149 / 1,000 min (~15¢/min) | Auto-upgrade to the next plan; 7-day trial |
| RingCentral AIR | Monthly minutes (round up 30s) | $49 / 100 min, or $39 + RingEX | Same, plus $0.50/min over | 14-day trial; $0.50/min is the dearest published minute rate |
| Dialzara | Monthly minutes (per-second) | $29 / 60 min | $99 / 220 min | $0.35–$0.48/min over; voicemail if the pool hits zero |
| My AI Front Desk | Minutes + chat/SMS/CRM bundle | $99/mo ($79 annual) / 200 voice min | Same bundle | ~$0.25/min voice over |
| Goodcall | Unique callers / month | $79 / 100 (~79¢/caller) | $129 / 500 (~26¢) | No minute meter; spam not billed |
| Smith.ai AI | Per answered call | Free / 25 calls | $150 / 75 calls ($2/call) | $1.67–$2.00 included; $2.17–$3 over. Hybrid ~$2.50–$3.70/call. Live human ~$7/call |

**Rule of thumb:** a credible after-hours product in this market is either about **$50–$150/month** for a few hundred minutes, **~$0.15–$0.50 per minute** above that, or **~$1.70–$2 per call**. Smith is priced as a qualified-lead service, not a cheap answering line. Our raw voice cost (~5¢/min) is well under every published retail rate, so packaging (minutes, a monthly plan, or a per-call fee) is a business choice, not a cost problem.

---

## 4. Gaps to close, in priority order

Aimed at an **after-hours and overflow** receptionist, not a full contact-center. “Easy” means the full-agent backend (AgentLab follow-up runs, connectors, chat config) can do most of the work without a new voice stack.

### P0 — table-stakes for after-hours / overflow

1. **Overflow as a real mode, plus a holiday calendar.** Competitors expect “answer when we are closed, or when no one picks up.” We only have `after_hours` vs `always`, and weekly hours with no closures. Easy: add `mode=overflow` (AI always answers whatever is forwarded to the number) and a holiday/closure list; document carrier call-forwarding (busy / no-answer / after-hours) the same way Rosie and Goodcall do. Native queue overflow like RingCentral is only worth it if we own the customer’s PBX; skip for now.

2. **Instant owner alerts by SMS and email.** Every competitor texts or emails the owner after (sometimes during) the call. We notify AgentLab and wait for the owner to ask the bot. Easy: default `after_call.follow_ups` (or a built-in send) to text/email the summary, caller, and callback. The post-call agent already exists.

3. **Custom intake scenarios.** Rosie’s “smart message taking,” Smith playbooks, and Goodcall’s question lists are the after-hours product. We have one generic message form. Easy: store named scenarios (“new job,” “existing customer,” “urgent”) with the questions to ask, and let the owner add them in chat. The voice tools only need to accept a scenario id and a structured payload.

4. **Warm transfer + a short fallback list.** After-hours overflow often means “try the on-call tech, then the owner, then take a message.” We have one number and we do not brief the person who picks up. Medium: keep the SIP bridge; add a private whispered summary to the transfer target, then try 2–3 numbers (Goodcall’s pattern) before `save_message`. Department routing can wait.

5. **Spam / robocall screening.** After-hours minutes get eaten by junk; Rosie, Smith, RingCentral, Goodcall and Dialzara all filter. Medium: Telnyx/Hiya or a reputation list at SIP ingress, plus an allow/block list the owner can extend (“mark this as spam”).

### P1 — expected once message-taking is solid

6. **Knowledge from the website / GBP / FAQs.** Setup at Rosie, RingCentral, Goodcall and Frontdesk is “paste your site.” We have a one-line `business_info`. Easy/medium for the backend agent to scrape and keep a FAQ list the voice agent can use. This is also the onboarding flow we are missing.

7. **Turn on SMS for real.** Booking links and confirmations are already coded, and the platform 866 number is the right sender so tenants do not need A2P. Blocked only on toll-free text verification and a first live send. Mid-call “I’ll text you the link” is a Rosie/RingCentral staple.

8. **Finish live booking, and add Google Calendar.** Microsoft live book with holds is a real differentiator once it works. Competitors almost all offer **Google Calendar**; many also offer Outlook and Calendly (we have the last two in the connector broker). Wire post-call CRM write-back to Salesforce and Zoho the same way — easy once sign-in works, because the follow-up agent can do it off the call.

9. **English/Spanish at least.** Rosie and Smith treat bilingual as default; RingCentral and Dialzara auto-switch. Medium: detect language and switch instructions/voice. Don’t chase 10+ languages until ES works.

10. **Call recordings.** Transcripts are not enough for disputes or “listen to what they said.” Medium: LiveKit room recording to the call log, with a link in the notification.

### P2 — later, or skip

11. **A simple call dashboard** (volume, outcomes, unanswered questions). RingCentral’s knowledge-gap report is the useful one; our bot can approximate it until we build a UI.

12. **Inbound SMS (and maybe web chat).** RingCentral and Frontdesk bundle this; Dialzara and Rosie sell it. Natural extension of the same agent, not required for v1 phone.

13. **Productized test callers / Quality Studio.** Smith and Goodcall use this as a trust loop. We are already planning an AI test caller for ourselves; worth keeping as a product feature.

14. **Skip for now:** Smith-style rented human agents; taking payments on the call (nobody serious advertises this, and PCI is painful); a native mobile app; HIPAA until a healthcare tenant asks; RingCentral-style queue integration.

---

## 5. What we already have that they often don’t

- A **full agent behind the phone**, so after the call we can email, book, file, or follow a plain-language instruction — not only dump a transcript into an inbox.
- **Config in chat** (`phone set …`), closer to Goodcall’s “tell Gabi” than to a rigid wizard.
- **Atomic appointment holds** to stop two after-hours callers from taking the same slot.
- A **platform SMS number** so customers can send booking links without their own A2P campaign.
- A **wholesale cost** (~5¢/min plus tokens) far below published retail, which leaves room for a simple monthly plan.

The short version: message-taking, hours, a single transfer, summaries, and a post-call brain are in place. To stand next to Rosie / Smith / RingCentral as an after-hours and overflow receptionist, the next features that matter are **overflow + holidays, instant owner texts/emails, intake scenarios, warm/waterfall transfer, and spam filtering** — then knowledge training, live SMS, finished calendar/CRM sign-in, Spanish, and recordings.

Sources cited in place above. Third-party pages used only to expand collapsed Rosie FAQs (plan math and auto-upgrade): [tradeaiguide.com/rosie-ai-review](https://tradeaiguide.com/rosie-ai-review/), [saaspilotreview.com/rosie-ai-pricing](https://saaspilotreview.com/rosie-ai-pricing/).
