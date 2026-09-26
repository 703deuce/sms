# Opus Stage 2 — wiring completion (Category A / B)

**Date:** 2026-09-26  
**Branch:** `cursor/opus-stage2-complete-wiring-2304`

## Classification rules (locked)

| Bucket | Meaning |
|--------|---------|
| **Category A** | Transovo genuinely does not possess the underlying capability or authoritative data. |
| **Category B** | Transovo has backend capability/data, but existing Opus UI cannot collect or expose it sufficiently. |
| **Must wire now** | Backend exists **and** Opus already provides sufficient UI — must be connected (target: **zero** remaining). |

Lack of a dedicated CRUD endpoint shaped like an Opus button is **not** Category A when wizard blob, onboarding, or setup multi-fetch already persists the behavior.

## Wiring completeness

Opus controls with matching Transovo backend capability are connected via `src/newui-transplant/connected/**`, adapters in `src/lib/newui-transplant/**`, and mirror `wired` props (no Opus DOM/copy/layout expansion). `newui/` was not modified.

**Narrow correction pass (this revision):**

- **Voice call handling — Add target:** uses `addTransferDestination` on appointment-receptionist wizard state; persists via existing Save.
- **Voice call handling — emergency keywords display:** reads `transferTriggers` (canonical), not urgency rule placeholders.
- **MCTB setup overview:** same multi-fetch as legacy `setup-overview-view` (setup, overview, exclusions, handoff, onboarding, live-test, voicemail) → status strip, pause/resume, attention, call-flow/operations rows, activity.
- **MCTB setup phone:** onboarding + setup APIs → carrier, ring timing, instructions, dial code, verification, verify-again, sender registration; save persists carrier/ring via onboarding POST.

## Remaining Category A — no underlying production capability / data

| Area | Opus element | Reason |
|------|----------------|--------|
| Global chrome | Top bar Search / Help / Notifications / avatar menu | No production command palette, help surface, or notification feed wired to Opus chrome. |
| Global chrome | Workspace switcher list | No multi-workspace switch API exposed to Opus shell (display-only workspace). |
| Global chrome | AI minutes sidebar meter | No authoritative usage quota API mapped to Opus meter. |
| Voice calls | Server-side “Needs attention” tab | `/api/voice/calls` has no `attention` query; attention derived client-side from outcome display. |
| Voice calls | Cursor pagination | API supports `limit` only (max 200), not offset/cursor pages. |
| Voice analytics | Daily “Booked” time series | Aggregate `appointmentsBooked` exists; per-day booked series not available from current analytics API. |
| Voice call handling | Recording retention “Change” | No appointment-receptionist / voice-receptionist retention field exposed for this product surface (display-only policy text when wired). |
| MCTB setup recovery | Blocked caller ID trigger | No runtime trigger capability documented. |
| MCTB notifications | “Forwarding stopped working” event row | No production event type / runtime signal. |
| MCTB setup links | Multi-link list + click analytics | Single default link URL supported; no multi-link product model. |
| MCTB setup phone | Throughput “75 msg/min” | No authoritative throughput metric on setup API. |
| MCTB conversations | Press-1-specific consent label on thread | Inbox API does not expose MCTB consent method per thread (product source only). |

## Remaining Category B — backend exists; Opus lacks UI to connect

| Area | Production capability | Missing Opus UI |
|------|----------------------|-----------------|
| Voice knowledge | FAQ edit/delete inline | List is read/add only; edit/delete need designed row actions (not `window.prompt`). |
| Voice receptionist | Full wizard fields (language, speed, capabilities grid) | Opus page is summary tiles; no inputs for those fields. |
| Voice numbers | Per-number detail management | Table rows lack detail deep-link affordance in Opus design. |
| Voice call handling | Edit on-call rotation | Wizard `onCallSchedule` exists; Opus only shows Edit with no schedule editor. |
| Voice call handling | Add emergency keyword | `transferTriggers` mutable via wizard; Opus “+ Add” has no phrase input. |
| Voice call handling | Recording retention change | No retention editor on Opus; backend retention not on receptionist wizard blob. |
| MCTB setup links | Edit default URL | Opus shows value without edit affordance on this pass. |
| MCTB setup overview | Pause presets (1h / tomorrow / custom) | Opus single Pause/Resume toggles indefinite pause via setup API only. |

## Must wire now (Opus UI + backend + still disconnected)

**Count: 0** after this correction pass for the scoped items (call handling add target, setup overview multi-fetch, setup phone onboarding bind).
