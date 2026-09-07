# Transovo MCTB Page Build Spec — 05: Visual Voicemail

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/voicemail`  
**Configuration route:** `/mctb/setup/voicemail` (Setup → Voicemail section)  
**Product:** Missed Call Text Back  
**Page archetype:** Operational inbox / master-detail workspace (+ separate configuration surface)  
**Canonical navigation:** MCTB → Voicemail (permanent operational peer)  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product screenshots + canonical Transovo design system  
**Governing documents:** All Transovo standards plus MCTB product/domain, IA, manifest, and page build specs 01–04

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-05-visual-voicemail.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

Visual Voicemail is a **first-class MCTB operational workspace**. It is not merely a voicemail greeting setting. The page must allow users to find voicemail messages, identify callers, listen to the original recording, read the authoritative transcription, use an AI-generated summary as an assistive derivative, understand the relationship to the originating missed call, and take appropriate follow-up actions such as calling the customer or opening the related conversation.

Voicemail **configuration** — recording/uploading greeting, Transovo TTS, ElevenLabs generation, greeting activation, voicemail behavior — belongs in **Setup → Voicemail** and must not clutter the daily inbox.

**Original audio recording remains authoritative.** Transcription and AI summaries are derived artifacts and must never replace or alter the original evidence.

---

## 2. Core product distinction

```
VOICEMAIL
├── Operational inbox (/mctb/voicemail)
│   Messages, Audio, Transcription, AI summary
│   Caller / missed-call context, Follow-up actions
│
└── Voicemail setup (/mctb/setup/voicemail)
    Greeting, Record, Upload, Transovo TTS, ElevenLabs
    Preview, Activate, Behavior / trigger configuration
```

Do not put the greeting builder above the voicemail inbox.

---

## 3. Primary user questions

| Surface | Question |
|---------|----------|
| **Operational inbox** | Who left me a voicemail, what did they say, and what should I do about it? |
| **Setup** | What should callers hear when they reach my voicemail? |

Different jobs — different surfaces.

---

## 4–5. Routes & main navigation (LOCKED)

**Operational:** `/mctb/voicemail` — legacy `/voice/voicemail` → redirect.

**Voicemail is a permanent peer** of Missed Calls and Conversations.

**Canonical operational group:**

```
Home | Missed Calls | Conversations | Voicemail | Analytics
```

**Configure group:** Setup | Numbers  
**Settings** (org-wide)

Do not demote Voicemail to setup-only.

---

## 6. Screenshot calibration & preserve runtime

Inspect Appointment inbox/master-detail, audio treatment, AI content, configuration editors, and **existing MCTB voicemail implementation**.

Preserve working: audio playback, transcription, AI summary, caller/number association, entitlement logic, greeting generation, TTS/audio paths.

---

## 7. Desktop operational architecture

```
┌──────────────────────┬──────────────────────────────────────┐
│ Voicemail list       │ Selected voicemail                     │
│ Search / Filters     │ Caller identity                        │
│                      │ Audio player (authoritative)           │
│                      │ AI summary (derived, labeled)          │
│                      │ Transcript (derived)                   │
│                      │ Related missed call / conversation     │
│                      │ Follow-up actions                      │
└──────────────────────┴──────────────────────────────────────┘
```

Optional third panel only if established Transovo pattern warrants it.

---

## 8–9. Page header & summary

**H1:** Voicemail — *Listen to voicemail, review transcripts, and follow up with callers.*

**Header action (secondary only):** **Voicemail settings** → Setup → Voicemail.  
**Not in operational header:** Record greeting, Generate voice, Upload audio.

**Optional compact summary:** New 3 | Needs follow-up 2 | Today 7 — only if runtime supports. Not another dashboard.

---

## 10–13. Search, filters, list item

**Search:** caller/contact name, phone; transcript text only if backend genuinely supports.

**Filters:** All | New/Unread | Needs follow-up | Reviewed | Today | Date | Business line | Has transcript / Transcription failed (under More if technical).

**List item hierarchy:**

```
Anthony Johnson
(571) 555-0184
"Hi, this is Anthony. I was calling about..."
Today · 10:42 AM     0:37
New
```

Preview from transcription excerpt if available — neutral indicator if not. No fake preview.

---

## 14–15. Selected voicemail header & actions

**Anthony Johnson** / (571) 555-0184  
*Voicemail · Today at 10:42 AM · Duration 0:37*  
*From missed call at 10:41 AM* → **View missed call**

**Primary:** Call customer — or **Open conversation** if caller already texted back.  
**Secondary:** Open conversation, View missed call, Mark reviewed/Resolve (if canonical), More.

---

## 16–19. Original recording (AUTHORITATIVE)

Always available when stored and permitted.

**Player:** Play, Pause, position, duration, seek, accessible labels. Optional: speed, ±10s if shared component supports.

Use established accessible audio component — not icon-only mouse-only custom player.

| State | Treatment |
|-------|-----------|
| Loading | *Loading recording…* |
| Failure | *Recording couldn't be loaded* + Retry — transcript/summary may remain |

Do not replace audio with transcription.

---

## 20–24. Transcription (DERIVED)

**Heading:** Transcript — machine-derived representation. Original artifact is **audio**.

Full readable selectable text. Not message bubbles — transcription document.

**States:** Processing | Ready | Unavailable | Failed — with localized messaging; audio remains usable when possible.

Do not fabricate confidence. Default: no in-place edit of machine transcript as historical evidence. Corrections = derived version with audit if supported later.

---

## 25–30. AI summary (DERIVED FROM TRANSCRIPT/AUDIO)

**Heading:** AI summary — explicitly labeled derived convenience artifact.

Hierarchy: **Recording (authoritative) → Transcript (derived) → AI summary (derived)**

- Do not present summary as verbatim caller speech
- AI must not auto-set Callback requested, consent, appointments, etc.
- No hallucinated facts not in underlying content
- Failure: *AI summary temporarily unavailable* — audio/transcript still work

---

## 31–35. Related objects & follow-up

**Related missed call** — compact + View missed call (canonical object, no duplicate).

**Related conversation** — compact + Open conversation (no embedded SMS inbox).

**Follow-up:** Needs follow-up, Assigned, Reviewed, Resolved — only if canonical domain owns state; no parallel voicemail task engine.

**Contact:** link to canonical Contact. **Repeat caller:** *Called 3× today* — separate voicemail artifacts per event.

---

## 36–39. State models

**Review:** New | Reviewed (and Listened if separately tracked — keep simple for V1 if possible).

**Orthogonal state families:**

- Audio: Available | Processing | Unavailable
- Transcription: Processing | Ready | Failed
- Follow-up: Needs follow-up | Resolved

Do not overload one giant status enum.

**Lifecycle (processing):** Voicemail captured → Recording stored → Transcription queued → Transcript ready/failed → AI summary queued → ready/failed — separate from New → Reviewed business state.

---

## 40. Timeline/activity

Chronological events only if they exist — no manufactured pipeline timestamps.

---

## 41–46. Empty & error states

| State | Treatment |
|-------|-----------|
| Active, no voicemail | *No voicemail yet* |
| Setup incomplete | *Finish voicemail setup* + CTA |
| Filtered empty | *No voicemail matches these filters* + Clear filters |
| Loading | Skeletons — no fake transcript placeholder |
| Partial | Audio works while transcript/summary process or fail independently |
| Inbox error | *Voicemail couldn't be loaded* + Retry |

---

## 47–48. Deep links & return context

`/mctb/voicemail/:id` — auth, tenant, load message/recording/transcript independently.

Return from Missed Call/Conversation restores selected voicemail, filters, search, position.

---

## 49–50. Business line & settings entry

*Received for (703) 555-4421* — no hidden ingress.

**Voicemail settings** → Setup → Voicemail — not inline setup controls in inbox.

---

## 51–72. Voicemail Setup (`/mctb/setup/voicemail`)

**Job:** Choose what callers hear + configure voicemail behavior.

**Greeting sources (one active artifact):** Transovo TTS | ElevenLabs AI voice | Record yourself | Upload audio

**States:** Draft | Generating | Ready | Active | Failed | Archived — not generic `saved=true`.

**Scope explicit:** workspace / business line / schedule variant.

**Method selector (user language):** Create with text | Use AI voice | Record myself | Upload audio

### Transovo TTS (default/simple)

Transovo voice + greeting text + preview → Generate preview | Save | Activate

### ElevenLabs

AI voice path where supported — voice selection, generate, preview, activate; cost disclosure if relevant.

### Record yourself

Real flow: Start → Recording… duration → Stop → Play | Record again | Use this recording. Microphone permission with upload fallback.

### Upload

Actual supported formats/limits; progress; validation; preview. Specific failure reasons when authoritative.

### Save vs Activate

Distinct if runtime supports drafts. If Save immediately activates, say so truthfully.

### Critical runtime rule

**Never replace active greeting until new artifact is valid/ready.** Generation/upload failure → existing greeting stays active:

*Greeting couldn't be generated. Your current voicemail greeting is still active.*

Optional compact greeting history if runtime supports reactivation.

---

## 73–77. Behavior settings

Only real controls: voicemail enabled, trigger/condition, max duration, transcription on/off, AI summary on/off, notifications, business/after-hours variants.

**Trigger relationship explicit:** e.g. *Text back after voicemail — On/Off* with consequence explained.

**Transcription dependency:** if AI summary requires transcript, enforce hierarchy — no impossible enabled combinations.

---

## 78–85. Language, retention, deletion, privacy

Greeting language may differ from admin UI locale. Transcript preserves original spoken language; translation is derived.

Retention: *Recording no longer available* when expired — not fake failure.

Delete only if real backend action with confirmation and permissions.

Tenant scoping, role auth, signed audio URLs, no secrets in client, no cross-tenant AI context.

---

## 86–93. Responsive & zoom

Desktop: list | detail; audio top; summary before transcript.

Mobile: list → full-screen detail (Caller → status/actions → audio → AI summary → transcript → context).

Mobile recording must work or truthfully offer upload fallback.

320px / 200% zoom pass for inbox and setup.

---

## 94–97. Keyboard & live updates

Full keyboard paths for operational and setup workflows.

Processing completion updates in place — announce *Transcript ready* without stealing focus.

Audio, transcript, summary load independently.

---

## 98–103. Cross-product relationships

Notifications link to canonical voicemail record. Analytics aggregates elsewhere — no charts in inbox.

Missed Call Detail: compact preview + link here — same recording/transcript object.

Conversation: contextual link only — do not merge into fake omnichannel stream.

**Terminology:** Voicemail **greeting** (business) vs voicemail **recording** (customer message).

Provider abstraction — no ElevenLabs API IDs in ordinary UI.

---

## 104–107. Visual hierarchy & treatment

**Detail order:** Caller → follow-up/action → **audio** → AI summary → transcript → related objects → activity.

AI summary: restrained shared assist visual language — no neon gradient hero card.

Transcript: readable content, not disabled form field.

Setup: controlled choice + contextual editor — not four giant method cards unless design system uses that pattern.

---

## 108–109. Six-state contracts

**Operational:** Normal | First-use empty | Loading | Error | Partial/degraded | Success/updated (reviewed/assignment).

**Setup:** Normal | First-use | Loading | Error | Partial (active greeting survives failed replacement) | Success/updated.

---

## 110–111. Runtime contract & integrity

Reuse authoritative fields: `voicemail_id`, `missed_call_id`, `conversation_id`, `recording_asset`, `transcription`, `ai_summary`, `review_state`, greeting `source_type`, `generation_status`, `active`, etc.

Never regenerate historical customer recording because greeting/provider/model changed.

---

## 112–113. Test scenarios

**Operational (A–K):** new voicemail full pipeline, audio/transcript/summary partial failures, related missed call/conversation links, repeat caller, empty states, multi-line, auth, mobile, keyboard/SR.

**Setup (A–K):** TTS load/preview/activate, ElevenLabs success/failure, record/upload paths, microphone denied, active greeting survives failure, mobile recording, keyboard-only.

---

## 114. Definition of done — Visual Voicemail

Cursor may mark Voicemail domain complete only when all checklist items in full spec are satisfied, including:

- Permanent MCTB nav destination
- Inbox vs setup distinct
- Audio authoritative; transcript/summary derived and labeled
- AI does not establish business truth
- Related missed call/conversation links
- Independent loading/failure per artifact
- Greeting setup: TTS, ElevenLabs, record, upload — preview before activate; active survives failed replacement
- Legacy `/voice/voicemail` resolved
- Desktop/tablet/mobile + a11y QA complete

---

## Build handoff

Next page in sequence: **06 — Analytics** — with Voicemail treated as a full MCTB outcome source alongside missed calls, text-backs, and conversations.
