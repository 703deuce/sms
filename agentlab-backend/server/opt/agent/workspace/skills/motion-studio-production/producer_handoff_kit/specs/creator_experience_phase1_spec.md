# Spec: Motion Studio creation experience (single release)

Owner handoff for ChatGPT. This is a self-contained build spec for the
Transovo Motion Studio customer creation experience. Do **not** treat
this as permission to deploy, restart, merge, or change production.
Do **not** edit render-worker, QA, or delivery code. Open a PR with the
front-end, job-brief, voice-library, and producer-skill changes below.
Rick (Tony) is the only approver.

Code basis (read these branches; creation UI is the same on both):

- Live app branch: `feat/self-hosted-motion-render-20261120` (tip at
  write-up was `2e13cc63f`; confirm with `git fetch` before branching).
- Master: `07e5b020`. The feature branch is based on master; commits
  after the merge-base are render and master-first delivery only.
- Repo: `703deuce/sms`. Implement in `new-app/` and
  `producer_handoff_kit/skills/motion-studio-production/`.

Branch from the current live branch so this work sits on top of
master-first MP4 delivery. Do not regress that behavior. Do not touch
render or QA files to "help" this work.

## Owner rules (these override everything else)

1. **One release.** Everything in this document ships together: labeling
   today's flow as Quick Create, Customize (the new optional inputs),
   custom script, personal commentary, reference links, custom footage,
   own music, visual style, brand profile, audience and tone, source
   preferences, uploaded narration, talking-head, voice cloning, My
   voices, the narrator picker, the typed job brief, and the matching
   producer-skill instructions. An optional read-only "Your video plan"
   summary may appear on the project page while production runs; it is
   not an approval gate. There is no Phase 2 or Phase 3. Tasks below
   are a build order, not separate launches.

2. **Most of the work is (1) the front end and (2) how each input is
   packaged for the production agent.** The producer bot can already
   handle these cases through its skill once it is told clearly what
   each input is and how to treat it. Label every input with a `role`
   and a `handling` rule in the job payload and in `GET {jobUrl}`.

3. **Prompt-first.** A customer who only types a sentence and clicks
   Start must get the same production quality as someone who fills in
   every optional control. No advanced field is required.

4. **Paid ElevenLabs music generation stays on by default.** Do not
   add an opt-in, and do not switch the default back to a silent or
   unpaid score. A customer may still upload their own track or choose
   no music.

5. **The watchable MP4 must appear in the customer's Transovo project
   as soon as it is rendered and passes technical QA.** Editable-project
   upload continues in the background and must never block the player.
   This work must not regress master-first viewing already present on
   the live branch.

6. **Do not change render or QA behavior.** No edits to the
   self-hosted render worker, technical QA checks, retry policy,
   black-frame logic (already removed), audio repair, or Chrome
   reaping. Leave those files alone.

7. **Do not add rights, licensing, or copyright warnings, gates, or
   source-rights checks, and do not mention them** in the UI, the job
   brief, progress copy, or the producer skill. The owner handles all
   of that. Do not add "source-rights warnings" to the plan screen.

8. **Go straight to production.** Start dispatches the producer
   immediately, the same as today (`createProject` then
   `POST /api/motion-studio/agent/jobs`). Do not add a pre-generation
   approval gate, and do not stop auto-starting on Start. If a "Your
   video plan" summary is shown, it is read-only on the project page
   while the job is already running. It must never pause production
   or require approval before the producer starts.

---

## 1. Current creation flow (as of the live branch)

Two pipelines exist. The live customer path is the producer bot
(Agent Bridge). The older DOC_PLAN / DOC_PRODUCE path still powers
Setup, Story review, and "Create production plan." Do not wire the new
experience to the legacy plan/produce jobs. Leave that code in place.

### 1.1 New video form

`new-app/app/app/motion-studio/new/page.tsx` renders
`new-app/components/motion-studio/motion-studio-create.tsx`.

The live form today has:

- Prompt textarea ("What are we creating today?")
- Video length (5s through 5 min, plus custom seconds)
- Video type (default "Anything / Custom"; catalog in
  `new-app/lib/motion-studio/creative-options.ts`, `MS_VIDEO_TYPES`)
- Visual style (default "AI decides" / `automatic`;
  `MS_CREATIVE_STYLES`)
- Canvas 16:9 / 9:16 / 1:1 and resolution 480p / 720p / 1080p
- Brand identity: none, customize this video, or saved Brand Kit
  (colors, typography, personality, consistency, logo placement,
  guidelines, logo upload, save/edit/delete kit)
- Additional creative instructions (free text) and "visual reference"
  image/video uploads (`creative.referenceUploadIds`)
- Optional attachments (photos, video, audio, script files)
- Start mode tiles: "Start with idea" / "Use a script" / "Edit my
  footage" (`MsWorkflow` in `new-app/lib/motion-studio/types.ts`,
  labels in `new-app/lib/motion-studio/config.ts`)

Start calls `client.createProject(...)` (`POST /api/motion-studio/projects`,
`createProject` in `new-app/lib/server/motion-studio/service.ts`) and
then, in live mode, immediately `POST /api/motion-studio/agent/jobs`
with only `{ projectId }`. That dispatches the producer. The customer
is then routed to `/app/motion-studio/{projectId}`.

### 1.2 Project setup and plan

`new-app/components/motion-studio/motion-studio-workspace.tsx`:

- If an agent job already exists, the workspace shows
  `AgentJobPanel` + `AgentChatPanel` and **skips** setup.
- If `project.status === 'setup'` and there is no agent job, it shows
  `SetupStep` (`new-app/components/motion-studio/setup-step.tsx`).

Setup (often never seen, because Start already dispatched a job)
exposes: length in minutes, visual direction (`cinematic` /
`explainer` / `investigative` / `technical_3d` — a second, overlapping
style system), voiceover (`ai` | `upload`), music (`generated` |
`upload` | `elevenlabs` | `none`), format, a locked media row, web
research On/Off (default Off in `DEFAULT_SETTINGS`), and Review mode
(Checkpoint vs Fully automatic). Then "Next: Create production plan,"
which calls the **legacy** `createPlan` → `DOC_PLAN` path, not the
producer bot.

`AllowancePanel` (`new-app/components/motion-studio/allowance-panel.tsx`)
already shows an estimate (credits are often null and labeled
"Included while charging is off").

### 1.3 API and job payload sent to the producer

Dispatch: `dispatchAgentJob` in
`new-app/lib/server/motion-studio/agent-bridge.ts`.

The **webhook body** is thin. It sends `action`, ids, `title`,
`prompt` (from `project.brief`), `videoType`, `categoryGuidance`,
`creative`, `durationSeconds`, aspect/size/fps, `quality`, a flattened
`style`, and it **hardcodes** `webResearch: true` and
`mediaPolicy: 'auto_plus_uploads'`. It does **not** send `workflow`,
`settings.script`, `settings.voiceover`, `settings.music`,
`settings.productionMode`, `settings.webResearch`, or any labeled
input roles.

The producer then calls `GET {jobUrl}`, which is
`botGetAssignment` in the same file. That document is richer: full
`settings`, `workflow`, `projectContext` (story, plan, narration,
music), and `inputs[]` with `{ uploadId, filename, mime, role, url }`.
Roles are inferred at create time in `attachUploads`
(`service.ts`): video → `footage`, image → `photo`, audio →
`narration` only if the filename matches
`/(^|[^a-z])(vo|voice|voiceover|narrat)/i`, otherwise `music`, text →
`script`. There is no talking-head role, no explicit music-vs-narration
picker, and no reference-link list.

`project.brief` is `prompt || script`. A typed script also lives at
`settings.script`. If both are present, the webhook `prompt` is only
the idea text; the script is easy for the producer to miss unless it
reads `settings`.

### 1.4 Checkpoint / story review

Legacy checkpoint: after `DOC_PLAN`, status `awaiting_review`, UI in
`story-review.tsx` and the workspace banner. The customer can approve
or request changes. `story.preservedUserScript` is a flag when the
workflow was `script` (always word-for-word today; there is no "let AI
improve" option).

Producer-bot checkpoints (`checkpoint-contract.ts`,
`POST .../agent/jobs/{id}/checkpoint`) are **resume state for the
bot**, not a customer approval screen. The agent path has
`needs_input` chat questions. Do not add a pre-generation "Your
video plan" approval step; a read-only summary may appear after
Start, while the job is already running.

### 1.5 Editable revisions

After a finished film, `AgentChatPanel` + `interpretCustomerMessage`
(`chat-assistant.ts`) can dispatch `revise_video` with `instruction`,
`selectedElementIds`, and optional `timeRangeMs`. The producer skill
(`SKILL.md` §9) already distinguishes targeted fixes (change only the
affected elements, paid TTS only for changed lines) from remakes.
Legacy director proposals and `regenerateScene` also exist for the old
pipeline. This is the right hook for post-generation edits; the brief
must carry the original labeled inputs so a revision still knows the
handling rules.

### 1.6 Brand kit

Workspace-scoped `MotionStudioBrandKit` (`schema.prisma`,
`new-app/lib/server/motion-studio/brand-kits.ts`,
`/api/motion-studio/brand-kits`). Snapshot into
`settings.creative` so later kit edits do not change earlier jobs.
Producer rules are already in
`producer_handoff_kit/skills/motion-studio-production/brand-and-type.md`.

### 1.7 Voice cloning today (not in Motion Studio)

Instant Voice Cloning already exists for the separate T2V product, not
for Motion Studio:

- UI: `new-app/components/t2v/t2v-voice-clone-modal.tsx` (name +
  upload id; no in-browser recorder in that modal)
- API: `POST /api/t2v/voices/clone` queues a `T2V_VOICE_CLONE`
  clips-worker job (and is behind `t2vFeatureDisabledResponse`)
- Worker: `worker/clips_worker/t2v/m9_jobs.py` posts to
  `https://api.elevenlabs.io/v1/voices/add`
- Table: `T2vSavedVoice` / `t2v_saved_voices` (workspace-scoped;
  default stored as `labels.role = 'default'`)
- Delete: `DELETE /api/t2v/voices/{voiceId}` also deletes the
  ElevenLabs voice
- Stock list: T2V loads the **full** ElevenLabs library, which we do
  not want in Motion Studio

Reuse the ElevenLabs key helper and the `/v1/voices/add` call shape.
Do **not** route Motion Studio cloning through the T2V feature gate or
the clips-worker queue. Clips-worker availability must not block a
customer from getting a voice on the create screen.

Motion Studio narration today: producer skill §2 "Voice" searches the
full ElevenLabs library per job when no voice is specified. Setup
only offers "AI voice" vs "Upload own." There is no voice picker and
no clone screen in Motion Studio.

---

## 2. Gap table

Status is relative to this spec, not to the ChatGPT product essay.

| Capability | Status | What is already there | What is missing |
|---|---|---|---|
| Prompt-first create / Quick Create | **exists** | Today's New video form and Start-to-producer dispatch in `motion-studio-create.tsx` | Label this existing flow "Quick Create." No behavior change |
| Video type, length, canvas, resolution | **exists** | Same form; `MsSettings` / `MsCreativeBrief` | — |
| Visual style | **partial** | `creative.style` + setup `visualDirection` (two systems) | One optional style control; stop sending two competing values |
| Brand profile / saved kit | **exists** | Form + `MotionStudioBrandKit` + `brand-and-type.md` | Surface it under Customize; still snapshot per job |
| Uploads (footage, photos, audio, script files) | **partial** | Attachments + `StudioAsset` + `inputs[]` | Explicit role per file; talking-head vs footage vs narration vs music; stop filename heuristics as the only signal |
| Custom script | **partial** | Workflow `script`, `settings.script`, "kept word for word" | Optional script in Customize without forcing the workflow tile; `exact` vs `improve` handling |
| Personal commentary | **missing** | Free-text `creative.instructions` is not the same thing | Dedicated commentary field + `creator_opinion` handling |
| Reference links | **missing** | Visual reference *file* uploads only | URL list the producer must include in research |
| Own music + placement | **partial** | Audio upload; setup music enum; producer prefers a customer track | Explicit music role, optional placement notes, default remains paid ElevenLabs when no upload |
| Audience and tone | **partial** | Brand personality + creative notes | Dedicated optional `audience` and `tone` fields on the brief |
| Source preferences | **missing** | Web research On/Off on setup; webhook forces `webResearch: true`; producer often sources web media anyway | Structured preferences in the brief; producer must honor them |
| AI / chosen stock voice | **partial** | Producer auto-picks from the full library | Curated 10–20 picker with previews; chosen `voiceId` on the brief; producer uses that id and does not re-search |
| Voice cloning + My voices | **missing** in Motion Studio (T2V only) | T2V clone job + `t2v_saved_voices` | Motion Studio record-or-upload screen, profile library, default, rename, delete |
| Uploaded narration | **partial** | Filename heuristic can set `voiceover: 'upload'` | Explicit narration upload; handling: transcribe and build around the performance; do not replace it |
| Talking-head | **missing** as a first-class input | Footage workflow is "edit my footage" (Path A: no research unless asked) | Role `talking_head`: preserve picture and sound, add researched cutaways, do not treat as a silent B-roll clip |
| Your video plan (optional read-only summary) | **missing** as a running-job summary | Legacy story checkpoint + `AllowancePanel` (do not reuse them as a start gate) | Optional read-only summary on the project page while production already runs; never a pause or approval step |
| Targeted post-generation edits | **partial** | Chat `revise_video`, skill §9 targeted fixes | Carry the original brief into revisions; UI copy that a small change should not rerun the whole film |
| Watchable MP4 as soon as rendered | **exists** on the live branch | Master-first delivery work already landed | Do not regress; do not retouch render/QA |
| Paid ElevenLabs music default | **partial** | Producer generates paid music under budget caps; setup default is `generated`, not `elevenlabs` | Default `music.mode = "elevenlabs"` for new jobs; keep paid generation on |

---

## 3. Front-end: Quick Create and Customize

Keep the existing New video route, prompt-first layout, and Start
button. Add a two-level control, not a second product or a second
editor.

### 3.1 Quick Create is already built

**Quick Create is today's existing New video flow.** It is already
built. The only Quick Create work is to rename and label that current
flow "Quick Create." Do not change what the form shows, which fields
are visible, the Start label, or what Start does.

Start must keep doing what it does today: `createProject` and then
immediately `POST /api/motion-studio/agent/jobs`. The customer goes
straight to production. Do not rename Start to "Review plan," and do
not insert an approval step.

Today's form already includes the prompt, length, video type, visual
style, canvas, resolution, brand kit, creative notes, visual
reference uploads, attachments, and the idea / script / footage
tiles. Leave all of that in place on Quick Create.

### 3.2 Layout

Stay on `/app/motion-studio/new` and
`motion-studio-create.tsx`.

1. Add a segmented control: **Quick Create** | **Customize**. Quick
   Create is the default and is the current form, unchanged.
2. The primary action stays **Start**. It creates the project and
   dispatches the producer immediately, as it does today. The
   dispatch payload must carry the typed, labeled brief (§5).
3. Under Customize, keep every current field and **reveal the new
   optional sections** from §3.3. None of those new fields are
   required. Prefill from whatever the customer already entered on
   Quick Create. Switching back to Quick Create must not delete
   values they entered in Customize; it only hides the extra
   sections. If those values are present, Start still sends them in
   the brief.
4. The idea / script / footage tiles stay as they are on Quick
   Create. In Customize they may also open the matching new section
   and set a suggested `workflow`. They are not separate products.

Unify style only inside the new Customize work: do not also show
setup's four-way `visualDirection` as a second style control. If
`style === "automatic"`, the producer invents the look (existing
brand-and-type rule). Do not move today's style, canvas, resolution,
brand-kit, or creative-notes blocks off Quick Create.

If the customer later has a default saved voice (from My voices),
Quick Create does not need a new narrator picker on the form. Start
may attach that default `voiceId` in the brief silently. Changing
the voice is a Customize action.

### 3.3 Customize sections (all optional)

Implement these as clearly labeled blocks on the existing form.
Use the current card/section styling.

**Script.** Paste or upload `.txt` / `.md` / `.doc` / `.docx` /
`.pdf` (today's accept list is fine). Radio:

- `exact` — "Follow this script word for word."
- `improve` — "Use this as the draft; the AI may tighten and improve
  it, without changing the meaning."

Default if a script is present: `exact` (same as today's script
workflow). If no script is present, omit the field.

**Personal commentary.** Textarea. Helper: "Your take. This stays
your opinion in the film; it is not treated as a verified fact."
Do not mix this into `creative.instructions`.

**Reference links.** Repeatable URL field, optional short note per
link. Validate URL shape. Cap at a reasonable number (for example 25).

**Custom footage and photos.** The existing attachment picker, but
each file gets an explicit role the customer can change:

- `footage` — use this picture in the film
- `photo` — use this still
- `talking_head` — I am speaking on camera (picture and sound)
- `narration` — this audio is my voiceover
- `music` — this audio is the score
- `reference` — visual inspiration only, not a source clip
- `logo` — already handled by brand kit
- `script` — already handled by the script block

Default role from mime is allowed (`video` → `footage`, `image` →
`photo`, `audio` → `music`) but the customer must be able to override
it in one click. A talking-head or narration file must never be
silently tagged as generic footage or music.

**Music.** If a file is tagged `music`, that is the score (paid
generation off for this job). Optional placement notes ("open on the
beat," "no music under interviews," "use this under the outro only").
If there is no music upload, the brief default is paid ElevenLabs
generation. Offer "No music" as an explicit optional choice only.
Do not offer a separate unpaid "generated score" default that turns
paid music off.

**Visual style.** Existing select, plus custom style text when
`custom` is chosen.

**Brand profile.** Existing brand-kit UI, unchanged in capability.

**Audience and tone.** Two optional fields. Tone may be a short
select plus optional free text: serious, conversational,
investigative, educational, humorous, dramatic, or custom. Audience
is free text ("YouTube documentary viewers," "new customers," etc.).

**Source preferences.** Optional text plus optional checkboxes or
chips the customer can leave blank: prefer primary footage, original
interviews, documents, official sites, or particular domains (free
text). This is direction for research, not a rights gate.

**Narration.** First-class control. See §4.

---

## 4. Narration, voice cloning, and the narrator picker

### 4.1 Narration modes (Customize)

One control, default `ai_voice`:

| Mode | Customer does | Handling (brief + skill) |
|---|---|---|
| `ai_voice` | Picks a stock voice, or leaves the default / auto pick | TTS from the script with `voiceId` if provided; if no id, producer searches the library as it does today |
| `cloned_voice` | Picks one of "My voices," or creates a new clone | Same TTS path, but `voiceId` is required and must be that clone. Never substitute a stock voice |
| `uploaded_narration` | Uploads or records an MP3 / WAV / M4A / WEBM | Transcribe, use the recording as the timing spine, build the picture around it, do not replace or "clean up" the performance with TTS |
| `talking_head` | Uploads a camera recording of themselves | Preserve the original picture and sound as the backbone. Research the subject, add B-roll, titles, charts, and graphics at the moments they discuss. Keep continuity and lip sync. Do not treat this as Path A "edit only, no research" unless the customer also says to use only this footage |

A job may have supporting footage *and* a talking-head file. The
talking-head file is the presenter; other footage is cutaway material.

### 4.2 Narrator picker (AI voice and cloned voice)

When mode is `ai_voice` or `cloned_voice`, show a picker:

1. **My voices** on top (the customer's saved clones). Each row:
   name, preview, "Use," overflow: Rename, Make default, Delete.
   A "Create a voice" action opens the cloning screen (§4.3).
2. Then a **short curated list of ElevenLabs stock voices** (about
   10–20, never the whole library). Each row: name, one-line
   description (gender / accent / tone), and a preview sample.
3. If the customer has a default voice, it is preselected. Quick
   Create uses that default silently.
4. Selecting a stock voice sets `narration.mode = "ai_voice"` and
   `narration.voiceId`. Selecting a clone sets
   `narration.mode = "cloned_voice"` and `narration.voiceId`.

Do not load or search the full ElevenLabs catalog in this UI.

### 4.3 Voice cloning screen

A modal or full-page step opened from "Create a voice." The customer
can either:

- **Record in the browser** with the microphone, or
- **Upload** an existing recording.

UI requirements:

- Voice name (required, 2–80 characters).
- Tabs or a clear choice: Record / Upload.
- Record: request `getUserMedia({ audio: true })`, use
  `MediaRecorder` (prefer `audio/webm;codecs=opus`, fall back to a
  supported audio mime). Show a timer, start / stop, play back, and
  re-record. Recommend about 30 seconds of clear speech. Accept
  roughly 10 seconds minimum and cap around 2 minutes. If the mic is
  denied, say the microphone is blocked and point the customer to
  Upload.
- Upload: accept `audio/mpeg`, `audio/wav`, `audio/x-wav`,
  `audio/mp4`, `audio/m4a`, `audio/webm`, `audio/ogg`. Use the
  existing Motion Studio / clips upload pipeline so the sample lands
  as a `clipUpload` in the workspace.
- After a good sample is in hand, `POST /api/motion-studio/voices`
  (below). Show a short "Creating your voice…" state. On success,
  add it to My voices, select it for this project, and close the
  screen.
- The customer may create several voices. Creating one does not
  delete another.

Do not add legal, rights, licensing, or copyright copy or toggles to
this screen.

### 4.4 My voices (customer profile)

Clones are saved to the customer's profile and reused across projects.

They can:

- Have several named voices
- Preview, rename, and delete a clone
- Set one as the default narrator (a clone or a stock voice)
- Clear the default

Deleting a clone must delete the ElevenLabs voice and the local row,
and must drop the default flag if it was the default. Existing
finished jobs keep the `voiceId` they were produced with; do not
rewrite history. If the customer deleted a clone, new jobs cannot
select it.

### 4.5 Database

Do not reuse `t2v_saved_voices` or the T2V routes. Motion Studio needs
its own API surface that works even when T2V is feature-gated, and
cloning must not depend on clips-worker.

Add two tables (Prisma in `new-app/prisma/schema.prisma`, mapped
names as you prefer):

```prisma
model MotionStudioVoice {
  id             String    @id // e.g. msv_<uuid>
  workspaceId    String
  userId         String
  provider       String    @default("elevenlabs")
  voiceId        String    // ElevenLabs voice id
  name           String
  kind           String    // "cloned" | "stock_favorite"
  sampleUploadId String?
  previewUrl     String?
  isDefault      Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([workspaceId, userId, provider, voiceId])
  @@index([workspaceId, userId, isDefault])
}

model MotionStudioStockVoice {
  id          String   @id
  voiceId     String   @unique // ElevenLabs premade voice id
  name        String
  description String   @default("")
  gender      String?
  accent      String?
  previewUrl  String
  sortOrder   Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Scope "My voices" by `workspaceId` + `userId`. During the current
no-login Motion Studio test workspace, use the same caller identity
`requireMotionStudioCaller` already uses, so voices still round-trip.

`MotionStudioStockVoice` is the curated catalog. Seed it from a
checked-in list so a fresh environment has voices without a manual
step:

- `new-app/lib/motion-studio/stock-voices.ts` — source of truth for
  the initial 10–20 ids, names, descriptions, and preview URLs.
- A seed / migration inserts those rows.
- Ops can enable, disable, reorder, or retitle rows in the table
  without a code change. The API serves enabled rows by `sortOrder`.
- How to pick the list: call ElevenLabs `GET /v1/voices` and/or
  `GET /v2/voices` with the existing server key, listen to official
  `preview_url`s, and choose a short set that covers male and female,
  younger and older, a few accents, and both calm documentary and
  more energetic reads. Store only those ids. Do not expose the rest
  of the library. Refresh preview URLs if they expire.

`kind = "stock_favorite"` is only needed if you want "default is a
stock voice" to live in `MotionStudioVoice`. Alternatively, store
the default as `isDefault` on a cloned row, or a nullable
`defaultStockVoiceId` on a tiny profile row. Pick one approach and
keep a single default per customer.

### 4.6 API routes

All under `/api/motion-studio`, authenticated with
`requireMotionStudioCaller`. Never return the ElevenLabs API key or
raw storage keys. Preview URLs may be official ElevenLabs preview
URLs or short-lived signed URLs to the customer's sample.

- `GET /api/motion-studio/voices`
  Returns `{ myVoices, stockVoices, defaultVoiceId }`.
- `POST /api/motion-studio/voices`
  Body: `{ name, sampleUploadId }`. Validates the upload belongs to
  the workspace, is audio, and is ready. Creates the ElevenLabs
  instant clone **in this request** (see §4.7), then inserts
  `MotionStudioVoice` with `kind: "cloned"`. Returns the saved row.
  If this is the customer's first voice and they have no default,
  set it as default. Timeouts should be long enough for IVC
  (around 60–180 seconds). On ElevenLabs failure, return a clear
  502 and do not insert a row.
- `PATCH /api/motion-studio/voices/{id}`
  Body may include `{ name?, isDefault? }`. Rename and/or set
  default (clearing the previous default in the same transaction).
- `DELETE /api/motion-studio/voices/{id}`
  Only for `kind: "cloned"`. `DELETE https://api.elevenlabs.io/v1/voices/{voiceId}`
  with `xi-api-key` (treat 404 as already gone), then delete the
  local row. Clear default if needed. Do not allow deleting stock
  catalog rows through this customer route.
- `POST /api/motion-studio/voices/default`
  Body: `{ voiceId, source: "cloned" | "stock" }`. Sets the default
  used by Quick Create and the picker.

Optional: `GET /api/motion-studio/voices/stock` if you want the
catalog alone. Not required if `GET /voices` already returns it.

Upload of the sample uses the existing upload mechanism the create
form already uses (`client.uploadFile`). Do not invent a second
upload stack.

### 4.7 How to call ElevenLabs

Use the existing server key helper
`getElevenLabsApiKey()` in `new-app/lib/server/ai/elevenlabs.ts`
(accept `ELEVENLABS_API_KEY` or legacy `ELEVENLABS_KEY`, same as
elsewhere). Do this in the Next.js route, not in clips-worker.

**Create instant clone**

`POST https://api.elevenlabs.io/v1/voices/add`

- Header: `xi-api-key`
- Multipart form: `name`, `files` (the sample), optional
  `remove_background_noise=true`, `description` (internal, e.g.
  workspace/user id — never shown to the customer)
- Response must include `voice_id`. Persist that id.
- After create, `GET https://api.elevenlabs.io/v1/voices/{voice_id}`
  to store a `previewUrl` when ElevenLabs provides one. If it does
  not, use a signed URL to the uploaded sample as the preview.

**Delete clone**

`DELETE https://api.elevenlabs.io/v1/voices/{voice_id}`

**Stock previews**

Use the `preview_url` stored on `MotionStudioStockVoice`. The
customer UI plays it with a simple `<audio>` control. Do not proxy
the whole library.

**Narration at production time**

The producer already knows how to call
`/v1/text-to-speech/{voice_id}/with-timestamps` with Flash
`eleven_flash_v2_5`. When the brief includes `narration.voiceId`,
it must use that id and must not search `shared-voices`. Model and
budget rules in the skill stay as they are (one paid TTS call for
the whole script, two at most, no silent fallback to scratch voice
on the final).

Do not build Professional Voice Cloning in this release.

Clones live in the shared ElevenLabs account. Tag or name them so
they can be attributed to a workspace/user, isolate them so one
customer is never shown another's voice, and always delete the
provider voice when the customer deletes theirs so slots are freed.
Do not invent a per-customer slot UI.

---

## 5. Typed job brief and producer handoff

This is the heart of the release. Every optional input the customer
provided must appear on both:

1. The webhook / queue dispatch payload (`dispatchAgentJob`)
2. `GET {jobUrl}` (`botGetAssignment`)

Do not rely on the producer to infer meaning from filenames or to
dig through loosely shaped `settings`. Put a single typed object on
the job, for example `brief` (name it consistently; `settings.brief`
plus a top-level `brief` copy is fine). Keep the original `prompt`
untouched (existing rule in `brand-and-type.md`).

### 5.1 Suggested TypeScript shape

Add this in `new-app/lib/motion-studio/` (for example
`creative-brief.ts` or an extension of `types.ts`) with a
`sanitizeProductionBrief` function, same style as
`sanitizeCreativeBrief`. Persist the sanitized object on
`MotionStudioProject.settings.productionBrief` at create time, and
send it on dispatch.

```ts
type ProductionBrief = {
  prompt: string
  workflow?: 'idea' | 'script' | 'footage'
  videoType: MsVideoType
  durationSeconds: number
  aspectRatio: '16:9' | '9:16' | '1:1'
  resolution: '480p' | '720p' | '1080p'
  style: { id: MsCreativeStyle; custom?: string }
  audience?: string
  tone?: {
    preset?: 'serious' | 'conversational' | 'investigative'
      | 'educational' | 'humorous' | 'dramatic' | 'custom'
    text?: string
  }
  brand?: MsCreativeBrief // existing snapshot; brandMode none => omit
  script?: {
    text?: string
    uploadId?: string
    role: 'script'
    handling: 'exact' | 'improve'
  }
  commentary?: {
    text: string
    role: 'commentary'
    handling: 'creator_opinion'
  }
  referenceLinks?: {
    url: string
    note?: string
    role: 'reference_link'
    handling: 'include_in_research'
  }[]
  narration: {
    mode: 'ai_voice' | 'cloned_voice' | 'uploaded_narration' | 'talking_head'
    voiceId?: string
    voiceName?: string
    voiceSource?: 'stock' | 'cloned' | 'auto'
    uploadId?: string
    handling:
      | 'tts_with_voice_id'      // stock or clone with voiceId
      | 'tts_auto_voice'         // no voiceId; producer may pick
      | 'voiceover_drives_timing' // uploaded narration
      | 'preserve_talking_head'  // camera recording + cutaways
  }
  music: {
    mode: 'elevenlabs' | 'upload' | 'none'
    uploadId?: string
    placement?: string
    role: 'music'
    handling: 'paid_generate' | 'use_uploaded_track' | 'no_music'
  }
  sourcePreferences?: {
    text?: string
    preferPrimaryFootage?: boolean
    preferOriginalInterviews?: boolean
    preferDocuments?: boolean
    domains?: string[]
    handling: 'honor_source_preferences'
  }
  inputs: {
    uploadId: string
    filename: string
    mime: string
    role:
      | 'footage' | 'photo' | 'talking_head' | 'narration'
      | 'music' | 'reference' | 'logo' | 'script'
    handling: string // see §6
  }[]
}
```

Defaults when the customer left a section empty:

- `narration.mode = "ai_voice"`, `handling = "tts_with_voice_id"` if
  a default or selected `voiceId` exists, else `tts_auto_voice`
- `music.mode = "elevenlabs"`, `handling = "paid_generate"`
- no script, commentary, links, or source preferences fields
- `inputs` only for files they actually uploaded

`createProject` must accept this brief (or the raw Customize fields
and sanitize them server-side). Do not trust client-side roles
without checking mime (a `talking_head` must be video; `narration`
and `music` must be audio; etc.).

### 5.2 Dispatch changes

Start keeps the current straight-to-production path. In
`dispatchAgentJob`, carried on that existing dispatch:

- Stop hardcoding `webResearch: true`. Honor the brief (and any
  remaining settings) instead.
- Include the full sanitized `brief` (or `productionBrief`) on the
  webhook body **and** on `botGetAssignment`.
- Include `workflow` and the existing `creative` snapshot as today.
- `inputs[]` roles must come from the brief, not from the filename
  heuristic. Keep signed URLs as they are (short-lived; producer
  already downloads immediately).

`POST /api/motion-studio/agent/jobs` stays called from the New video
Start button (and from later revisions, as today). Do not move
dispatch behind an approval screen.

### 5.3 Revisions

`revise_video` payloads must include the **same** `brief` (the
original labeled inputs and handling rules) plus `instruction`,
`selectedElementIds`, and `timeRangeMs`. The producer must still
obey "commentary is opinion," "script exact," "do not replace the
uploaded voiceover," and "preserve talking-head" during a revision.

---

## 6. Producer-skill instructions (add to the skill, one release)

Update `producer_handoff_kit/skills/motion-studio-production/SKILL.md`
intake (section 3) and the path rules, plus a short pointer in
`film-pipeline.md` and `brand-and-type.md`. The engine already can
do this work; the skill must make the handling rules unambiguous.

Intake addition: after `GET {jobUrl}`, read `brief` (or
`productionBrief`). Download every `inputs[]` file immediately, as
today. Then apply the following, in this order when they conflict:
hard skill rules (safety, secrets, untrusted-input) > explicit
`handling` on the brief > the customer's prompt > category
guidance > optional style.

| Input | Handling rule the producer must follow |
|---|---|
| `script.handling: "exact"` | Use the customer's words verbatim as the narration / on-screen script. Do not rewrite, tighten, or "improve." Timing adjustments may only add pauses, not new words. |
| `script.handling: "improve"` | Treat the text as the draft. The AI may tighten wording and structure but must keep meaning, claims, names, and any lines the customer marked as essential. |
| `commentary.handling: "creator_opinion"` | Incorporate the commentary as the creator's interpretation or argument. Attribute it as their view in the story. Never restate it as a verified fact, and never drop it because it is an opinion. |
| `reference_link` / `include_in_research` | Read and use these sources in research. Prefer them when they cover a claim or event. If a link fails, note it in the job log and continue with the others. |
| `inputs.role: "footage"` or `"photo"` | Use these in the film. They outrank sourced media for the same beat when they are relevant. |
| `inputs.role: "reference"` | Direction only (palette, pacing, type feel). Do not copy the reference, same as today's `referenceUploadIds` rule. |
| `narration.handling: "tts_with_voice_id"` | Narrate the script with ElevenLabs Flash and **this** `voiceId`. Do not search the library. Do not substitute another voice. |
| `narration.handling: "tts_auto_voice"` | Today's behavior: search the library, preview, pick, log the id and why. |
| `narration.handling: "voiceover_drives_timing"` | Transcribe the uploaded narration. The recording is the timing spine and the final voice. Do not replace it with TTS. Build scenes and graphics to the recording. Duck music under it. |
| `narration.handling: "preserve_talking_head"` | The upload is both the picture and the audio backbone. Keep the speaker's performance, continuity, and lip sync. Research the subject and insert B-roll, titles, charts, and graphics at the moments they mention, then return to the speaker. This is **not** Path A "no research, no B-roll unless asked." Path A remains only for ordinary "edit my footage" jobs without this role. |
| `music.handling: "paid_generate"` | Keep current paid ElevenLabs music generation (budget caps already in the skill). This is the default when the customer did not upload music or choose no music. |
| `music.handling: "use_uploaded_track"` | Use that track as the score. Honor optional `placement`. Time transitions to the track when the customer asked for it. Do not generate a replacement score. |
| `music.handling: "no_music"` | No score. |
| `sourcePreferences` | Honor them while researching and choosing media (for example, prefer primary footage, interviews, documents, or listed domains). This is editorial direction only. |

Also:

- If `voiceId` is present, skip the "best voice from the full
  library" search from skill §2 for this job.
- Keep live delivery / render-first rules unchanged.
- Keep targeted revision rules in §9. A request like "change the
  narrator to my cloned voice," "replace this scene with my
  footage," "make this section sound more like my opinion," or
  "rewrite this paragraph only" must change only the affected
  script, narration, footage, or timeline section, and must not
  rerun the entire research-and-production process.
- Do not add licensing or rights checks to the skill as part of
  this work (the existing "No licensing work" rule already forbids
  that).

---

## 7. Optional read-only "Your video plan" summary

This is not an approval gate and must never pause or delay
production. Start already dispatched the producer.

If you keep a "Your video plan" block, show it as a **read-only
summary on the project page while production is already running**,
alongside the existing agent progress UI. Reuse `AllowancePanel`
only as information, not as a confirm step.

The summary can list, from the brief:

- Title / prompt (short)
- Format (video type, length, canvas, resolution)
- Narrator (stock voice name, "Your voice: {name}", "Your uploaded
  narration," or "Your on-camera recording")
- Script (none / follow exactly / AI may improve)
- Commentary (yes/no, short excerpt)
- Reference links and uploaded file counts by role
- Music (paid generated score, customer track, or none)
- Style, brand, audience, tone, source preferences — only if set
- Estimate from the existing allowance helper (credits if present,
  otherwise the current "Included while charging is off" copy)

There is no **Approve and start**, no **Back to edit** that holds
the job, and no requirement to confirm the plan before generation.
Do not wire this summary to the legacy story checkpoint or to
"Create production plan." Do not include rights, licensing, or
copyright warnings.

The old Checkpoint / Fully automatic setup control and "Create
production plan" button can stay in the codebase for the unused
legacy path. They are not part of Quick Create or Customize, and
they must not become a new start gate.

---

## 8. After generation

Keep the existing chat revision path. In the customer-facing assistant
copy, make it clear that a small change should not rebuild the whole
film. The producer skill already says this; the brief must travel
with the revision so handling rules still apply.

No new editor. No render/QA changes. The MP4 remains visible as soon
as it is ready, including while a revision is queued (today's "keep
the previous version available" behavior).

---

## 9. Build order (one release, with acceptance criteria)

These tasks are sequenced so each has a place to land. They ship
together. Start keeps going straight to production on every slice.
The first slice is the typed, labeled brief on that existing
dispatch. The real new work after that is Customize (optional
inputs) plus voice cloning, My voices, and the curated picker.
Quick Create work is only a rename/label of the current flow.

### Task A — Typed, labeled brief on today's Start dispatch (first slice)

- Add the TypeScript type, sanitizer, and persistence on
  `createProject`.
- `dispatchAgentJob` and `botGetAssignment` include the full brief
  and labeled `inputs[]`.
- Remove the hardcoded `webResearch: true`.
- Keep `POST /api/motion-studio/agent/jobs` on the New video Start
  button, exactly as today. Do not add an approval gate or stop
  auto-starting.
- Tests around `createProject`, sanitizer, and the assignment
  document (extend existing motion-studio tests).

**Accept:** Start still creates the project and immediately queues a
producer job. A create call with a script (`improve`), commentary,
two links, a music upload, and a talking-head file stores the correct
roles and handling, and `GET {jobUrl}` returns them on that same
dispatched job. Filename-only heuristics are not the source of truth
when an explicit role was provided. A prompt-only Start still
dispatches immediately with defaults (paid music on, AI voice auto
or the customer's default voice).

### Task B — Label Quick Create; add Customize inputs

- Label the current New video flow "Quick Create." No behavior
  change: same fields, same Start button, same immediate dispatch.
- Add the Quick Create | Customize toggle. Customize reveals the
  new optional sections from §3.3, explicit upload roles, and the
  narration mode control (the picker can be a stub until Task C, but
  the mode and upload fields must work).
- Start from either tab still dispatches immediately with the brief
  from Task A.

**Accept:** A prompt-only Quick Create run behaves like today's form
and goes straight to production. A fully filled Customize run also
starts immediately and creates a valid labeled brief. Switching
Quick Create ↔ Customize does not drop entered values. No advanced
field is required to proceed.

### Task C — Voice library, cloning screen, narrator picker

- Tables, seed catalog, APIs, record-or-upload UI, My voices
  (rename, delete, default), curated picker with previews, all in
  Customize (and My voices management as specified).
- Chosen `voiceId` + mode written onto the brief and sent on the
  existing Start dispatch.
- ElevenLabs IVC create/delete called from the Motion Studio API as
  specified. No T2V feature gate, no clips-worker dependency.

**Accept:** A customer can record a sample in the browser, get a
clone, see it under My voices, set it as default, preview a stock
voice, pick one, and have that `voiceId` appear on the project brief
when Start dispatches. Deleting the clone removes the ElevenLabs
voice and the local row. A second customer (or user) never sees the
first customer's voices. A Quick Create Start with a default clone
writes `cloned_voice` + that id without requiring the customer to
open Customize.

### Task D — Optional read-only plan summary (not a gate)

- Optional read-only "Your video plan" summary on the project page
  while the producer job is already running. Estimate via
  `AllowancePanel` is informational only.
- No approve, no hold, no back-to-edit that delays dispatch.

**Accept:** After Start, the producer job is already queued or
running. If the summary is shown, it matches the brief (length,
narrator, music, script mode, file counts) and has no rights
warnings and no approval actions. The legacy "Create production
plan" path is not used by this flow.

### Task E — Producer skill intake

- Skill + film-pipeline / brand-and-type updates from §6.
- When `voiceId` is set, the producer uses it.
- Talking-head and uploaded-narration handling as specified.
- Commentary remains opinion. Exact script stays verbatim.
- Paid music default unchanged when `handling: "paid_generate"`.
- Targeted revisions still apply, and they inherit the brief.

**Accept:** A walkthrough (or producer-kit test notes) shows the
intake checklist reading each handling rule. A job with
`tts_with_voice_id` does not search the library. A job with
`preserve_talking_head` researches and adds cutaways. A job with
`voiceover_drives_timing` does not TTS-replace the recording. A job
with `creator_opinion` does not turn the commentary into a stated
fact. A job with `use_uploaded_track` does not generate a new score.

### Task F — Revision brief continuity and copy

- Revision dispatches include the original brief.
- Assistant copy does not promise a full remake for a local change.

**Accept:** A finished project that was built with a cloned voice and
exact script, then asked to "replace scene 3 with my uploaded
footage," sends `revise_video` with those original handling rules
plus the new instruction.

Do not include render-worker or QA tasks in this PR.

---

## 10. Files you will likely touch

Front end and types:

- `new-app/components/motion-studio/motion-studio-create.tsx`
- `new-app/components/motion-studio/motion-studio-workspace.tsx`
- `new-app/components/motion-studio/setup-step.tsx` (do not make it
  a start gate; Start already dispatched the producer)
- `new-app/components/motion-studio/allowance-panel.tsx` (reuse only
  in a read-only running-job summary, if you add one)
- new components for the narrator picker, clone / record UI, and
  optional read-only plan summary
- `new-app/lib/motion-studio/types.ts`
- `new-app/lib/motion-studio/creative-options.ts`
- `new-app/lib/motion-studio/config.ts` (labels, including Quick
  Create / Customize; keep the Start label)
- `new-app/lib/motion-studio/client.ts` if create/update payloads
  change
- `new-app/tests/motion-studio/motion-studio-create.test.tsx` and
  new tests for brief sanitizer, voices, and immediate Start
  dispatch

API / server:

- `new-app/lib/server/motion-studio/service.ts` (`createProject`,
  settings parse, `attachUploads` roles)
- `new-app/lib/server/motion-studio/agent-bridge.ts`
  (`dispatchAgentJob`, `botGetAssignment`)
- `new-app/app/api/motion-studio/projects/route.ts` (only if the
  create body shape needs a wider pass-through; keep validation in
  the service)
- new `new-app/app/api/motion-studio/voices/**`
- new `new-app/lib/server/motion-studio/voices.ts`
- `new-app/prisma/schema.prisma` plus a migration for the two tables
  and stock-voice seed

Producer:

- `producer_handoff_kit/skills/motion-studio-production/SKILL.md`
- `film-pipeline.md`
- `brand-and-type.md`
- `RULES_FROM_RICK.md` only if a short pointer is useful; do not
  contradict this spec

Do not touch:

- Render worker, `scripts/render/**` behavior, QA modules, master-first
  delivery, Chrome reaping, or storage-reuse code
- T2V voice routes (leave them alone; do not feature-gate Motion
  Studio on them)

---

## 11. Out of scope

- Professional Voice Cloning
- Multiple-speaker / podcast assembly as a special product mode
  (ordinary interview footage can still be uploaded as footage)
- A second editor or a new render pipeline
- Charging / credit pricing changes (keep "Included while charging
  is off" until Rick sets numbers)
- Merging or deploying unrelated PRs (#1270, #1271, etc.) unless
  Rick says so
- Any rights, licensing, or copyright UI
- A pre-generation approval gate, a "Review plan" start button, or
  any change that stops Start from dispatching the producer
  immediately

The creation experience should feel like a professional producer
that follows directions: the customer provides as much or as little
as they want, Start goes straight to production, every provided
input is labeled, and the engine fills in the rest.
