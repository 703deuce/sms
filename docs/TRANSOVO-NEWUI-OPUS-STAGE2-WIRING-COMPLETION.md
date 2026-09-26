# Opus Stage 2 — wiring completion (Category A / B)

**Date:** 2026-09-26  
**Branch:** `cursor/opus-stage2-complete-wiring-2304`

## Wiring completeness

For production Stage 2 routes, Opus controls that have a matching Transovo backend capability are connected via `src/newui-transplant/connected/**`, adapters in `src/lib/newui-transplant/**`, and thin mirror `wired` props (no Opus DOM/copy/layout changes). `newui/` was not modified.

Confirmed for this pass:

- No hardcoded AI Recovery save payloads (reads live control state + `/api/mctb/lead-recovery/config`).
- Production connected paths do not fall back to sandbox dynamic rows for missed calls, inbox, voicemail list, or AI Recovery when API data is empty.
- No legacy editor embeds added.

## Remaining Category A — no underlying production capability / data

| Area | Opus element | Reason |
|------|----------------|--------|
| Global chrome | Top bar Search / Help / Notifications / avatar menu | No production command palette, help surface, or notification feed wired to Opus chrome. |
| Global chrome | Workspace switcher list | No multi-workspace switch API exposed to Opus shell (display-only workspace). |
| Global chrome | AI minutes sidebar meter | No authoritative usage quota API mapped to Opus meter. |
| Voice calls | Server-side “Needs attention” tab | `/api/voice/calls` has no `attention` query; attention derived client-side from outcome display. |
| Voice calls | Cursor pagination | API supports `limit` only (max 200), not offset/cursor pages. |
| Voice analytics | Daily “Booked” time series | Aggregate `appointmentsBooked` exists; per-day booked series not available from current analytics API. |
| Voice call handling | Add target / Edit on-call / Add keyword / Retention Change as discrete instant mutations | State lives in appointment-receptionist wizard blob; no separate CRUD APIs (Save persists wizard). |
| MCTB setup overview | Pause button, call-flow/operations/activity demo rows when overview APIs not loaded | Full fidelity needs same multi-fetch as legacy `setup-overview-view` (partial wiring: status strip only). |
| MCTB setup phone | Carrier select, ring timing, instructions body, verify-again | Requires onboarding/forwarding APIs bound to Opus controls (partial: lines + save hook only). |
| MCTB setup recovery | Blocked caller ID trigger | No runtime trigger capability documented. |
| MCTB notifications | “Forwarding stopped working” event row | No production event type / runtime signal. |
| MCTB setup links | Multi-link list + click analytics | Single default link URL supported; no multi-link product model. |
| MCTB conversations | Press-1-specific consent label on thread | Inbox API does not expose MCTB consent method per thread (product source only). |

## Remaining Category B — backend exists; Opus lacks UI to connect

| Area | Production capability | Missing Opus UI |
|------|----------------------|-----------------|
| Voice knowledge | FAQ edit/delete inline | List is read/add only; edit/delete need designed row actions (not `window.prompt`). |
| Voice receptionist | Full wizard fields (language, speed, capabilities grid) | Opus page is summary tiles; no inputs for those fields. |
| Voice numbers | Per-number detail management | Table rows lack detail deep-link affordance in Opus design. |
| MCTB setup links | Edit default URL | Opus shows value without edit affordance on this pass. |
| MCTB setup phone | Carrier / verification editor controls | Opus shows static selects/buttons without wired handlers yet (Category A partial). |
