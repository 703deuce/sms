# New UI Phase 2 — Remaining wiring exceptions

After the user-directed wiring pass on `cursor/newui-stage2-transplant-2304`.

## 1. Opus controls/values with no production backend equivalent

| Surface | Opus control / value | Notes |
|--------|----------------------|--------|
| `/voice/call-handling` | Add target / Edit on-call / + Add keyword / Retention Change | Destination and keyword CRUD live in appointment-receptionist wizard state; no discrete REST endpoints for these Opus affordances (save draft on page Save only). |
| `/mctb/setup/recovery` | Blocked caller ID trigger | No runtime trigger rule in MCTB setup API. |
| `/mctb/setup/notifications` | Forwarding stopped working event row | No `MctbHandoffEventType` for this label (row is display-only). |
| `/mctb/setup/notifications` | Per-recipient Edit (⋯) | Recipient update/delete not exposed as separate Opus actions (add + matrix toggles persist via `/api/mctb/handoff`). |
| `/mctb/setup/links` | Add link / secondary link rows / click counts | Production: `defaultLinkUrl` + public request form only; no multi-link CMS or per-link analytics on setup API. |
| `/mctb/setup/voicemail` | ElevenLabs / Record / Upload source tiles (non-TTS) | TTS script + activate + transcription flag wired; alternate greeting sources use legacy voicemail studio flows. |
| `/voice/knowledge` | Edit hours | Navigates to `/voice/setup` (canonical hours editor); no inline modal on this Opus page. |
| `/voice/analytics` | Booked time-series (second chart line) | API exposes aggregate `appointmentsBooked`, not daily booked series. |
| `/voice/analytics` | Usage meters / advanced latency panel | Billing usage and p95 blocks are static Opus chrome without a single analytics API field map in this pass. |

## 2. Remaining sandbox/mock data on Stage 2 path (when production empty)

| Surface | Behavior |
|--------|----------|
| Mirror routes without `wired` prop | Sandbox demo rows still used (preview / story paths only). |
| Connected routes | When `wired` is passed, lists use **empty** arrays instead of demo filler (no fake transfers, gaps, links, etc.). |
| Sidebar/topbar | Static nav badges / AI minutes (unchanged; static Opus chrome). |

## 3. Fake saves / actions

None on connected paths. Opus buttons without handlers are limited to section 1.

## 4. Connected pages beyond adapter boundary

| File | Issue |
|------|--------|
| `connected/voice/analytics-page.tsx` | Production data; layout matches Opus analytics but is not yet routed through `TransplantVoiceAnalyticsPage` mirror component. |

## 5. Opus page structure differs from canonical mirror

None for wired detail routes (`detail-view.tsx` compositions).

## 6. Wired in this pass (previously listed as exceptions)

- Knowledge: Dismiss / Add answer → `PATCH /api/voice/knowledge-gaps`; Upload → `/api/voice/knowledge/:id/upload`; Add FAQ → `knowledgeItems` + receptionist save; Save reads core fields from existing inputs.
- MCTB voicemail: `transcriptionEnabled` → `/api/phone/voicemail` `update_box`.
- MCTB notifications: Add recipient → `POST /api/mctb/handoff`; event matrix toggles persist.
- MCTB links: Demo secondary rows removed when `wired` is active.
- Call handling: Holiday switch maps to `businessSchedule.holidays` (off clears list; on retains existing holidays).
- Call detail: Mark handled → `PATCH /api/voice/calls/:id` call feedback.

## 7. UI unchanged

Only `wired` callbacks and `wired`-active empty states; no new sections or layout changes.

## 8. `newui/` untouched

Confirmed — no edits under repository `newui/` sandbox source tree.
