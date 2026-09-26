# New UI Phase 2 — Remaining wiring exceptions

After completing the continuation pass on `cursor/newui-stage2-transplant-2304`.

## 1. Opus controls/values with no production backend equivalent

| Surface | Opus control / value | Notes |
|--------|----------------------|--------|
| `/voice/call-handling` | Holiday schedule switch | No dedicated holiday flag in appointment-receptionist wizard state wired here |
| `/voice/call-handling` | Add target / Edit on-call / + Add keyword / Retention Change | Destination CRUD and keyword editor live in legacy operational editors, not exposed as discrete APIs for these Opus affordances |
| `/mctb/setup/recovery` | Blocked caller ID trigger | No runtime trigger rule |
| `/mctb/setup/notifications` | Forwarding stopped working event row | No handoff event type |
| `/mctb/setup/notifications` | Add recipient / row edit actions | Recipient CRUD exists on `/api/mctb/handoff` but Opus affordances are not full editor parity |
| `/mctb/setup/links` | Non-default link rows + click counts + Add link | Production has default URL + request form only |
| `/mctb/setup/voicemail` | Transcribe voicemail switch | No MCTB setup flag located separate from inbox/runtime |
| `/mctb/setup/voicemail` | ElevenLabs / Record / Upload source tiles (non-TTS) | Greeting persistence wired for TTS script + activate; other sources need legacy greeting studio flows |
| `/voice/knowledge` | Dismiss / Add answer on gaps | Gap resolution APIs exist but not mapped to these Opus buttons in this pass |
| `/voice/knowledge` | Add FAQ / Upload source | List/read wired; create/upload actions not bound to Opus buttons |
| `/voice/calls/[id]` | Mark handled | No PATCH action beyond call feedback rating |
| `/voice/analytics` | Booked time-series (second chart line) | API exposes aggregate `appointmentsBooked` only, not daily booked series |

## 2. Remaining sandbox/mock data on Stage 2 path (when production empty)

| Surface | Fallback |
|--------|----------|
| `/mctb/setup/links` | Secondary demo link rows when only one production default URL exists |
| `/voice/call-handling` | Demo transfers/keywords when wizard has zero destinations / urgency keywords |
| `/mctb/setup/notifications` | Demo recipients/events until `/api/mctb/handoff` loads |
| Sidebar/topbar | Static nav badges / AI minutes (unchanged; static Opus chrome) |

## 3. Fake saves / actions

None intentional on connected paths after this pass. Opus buttons without handlers still render but no-op where listed in section 1.

## 4. Connected pages beyond adapter boundary

| File | Issue |
|------|--------|
| `connected/voice/analytics-page.tsx` | Still renders Opus analytics layout inline (not `TransplantVoiceAnalyticsPage` mirror). Data is production; chart shows calls series only (see §1). |

All other Stage 2 routes render mirror `Transplant*` components with `wired` props.

## 5. Opus page structure differs from canonical mirror

None for routes wired in this pass. Detail routes now use `detail-view.tsx` mirror compositions matching sandbox `[id]` pages.

## 6. Confirmation — dynamic values/actions

All other Opus-drawn dynamic fields on the targeted routes load or persist through existing production APIs (`/api/solutions/appointment-receptionist`, `/api/voice/call-handling/recent-transfers`, `/api/mctb/setup`, `/api/mctb/handoff`, `/api/phone/voicemail`, `/api/mctb/setup-test`, `/api/mctb/live-test`, `/api/voice/knowledge*`, `/api/voice/calls/:id`, `/api/mctb/missed-calls/:id`, `/api/voice/analytics`, `/api/voice/knowledge-gaps`).

## 7. UI unchanged

No new sections, controls, labels, or layout changes beyond optional `wired` prop plumbing inside existing mirror components (same DOM structure).

## 8. `newui/` untouched

Confirmed — no edits under repository `newui/` sandbox source tree.
