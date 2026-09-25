# Voice nav reconciliation — 5s copy

**Branch:** `cursor/voice-nav-reconciliation-2304` · **PR:** #516 · **Report:** `docs/VOICE-FINAL-NAVIGATION-RECONCILIATION.md`

**Done:** Bundled MCTB + standalone `ai_after_hours` now share one six-item Voice nav (Overview, Calls, Receptionist, Business Knowledge, Call Handling, Analytics) via `voice-ia-nav.ts`. Legacy **AI Agent** / **Inbound Routing** peers removed from primary nav; `/voice/inbound-routing` stays advanced. No page redesign, no Voice/MCTB runtime changes.

**Tests:** `test-voice-ia-nav`, `test-mctb-nav-ia`, `test-product-shell`, `test-ai-after-hours-cert` — pass (PSTN manual still pending on cert).

**Status:** VOICE NAVIGATION RECONCILIATION COMPLETE — READY FOR FINAL CROSS-PAGE CERTIFICATION

**Next:** Read-only audit of all six Voice pages, then owner browser/PSTN cert. Overview impl stays on #515.
