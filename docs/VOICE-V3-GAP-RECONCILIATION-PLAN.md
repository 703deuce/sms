# Voice V3 gap-closure → master reconciliation plan

**Baseline (authoritative):** `origin/master` @ `d5db122e` (2026-09-22).  
**Recovery sources:** `cursor/voice-v3-gap-closure-2304`, delta `cursor/voice-v3-final-completion-2304` (7 commits after gap).  
**Rule:** **Current master is the base.** Recover missing capability; never replace newer master architectures.

---

## Phase 1 — Capability map (A–E)

| Capability | Class | Master | Gap / final | Action |
|------------|-------|--------|-------------|--------|
| Call history / transcript / summary (`runVoiceV3CallHistoryPostProcess`, `call-history/*`, forensics) | **A** | Newer pipeline | Gap used `processVoiceV3CompletedCall` | **Preserve master**; attach side effects only |
| Native FileSearch / vector stores | **A** | `resolve-agent-knowledge-retrieval`, LiveKit FileSearch | Gap added FileSearch + delegated tool | **Preserve master FileSearch**; delegated tool **complementary** when no vector stores |
| Microsoft FIND/BOOK + `persist-booking-after-confirmation` | **A** | Certified path | Gap refactored via `calendar-provider-runtime` | **Semantic merge** — provider runtime, keep persist |
| Urgency evaluation/execution | **B** | Module only | Wired in transfer + callback | **Recover** |
| On-call resolution + after-hours gating | **B** | Libs on disk | Wired in `authorize-transfer` | **Recover** |
| AI Call Recovery SMS | **B** | Config only; settle job no-op | `ai-call-recovery-sms.ts` | **Recover** into master post-call pipeline |
| Spam / solicitation (Telnyx + blocklist + publish) | **B** | Not present | `spam-protection/*` + APIs | **Recover** (LiveKit ingress prompts: **C** — see report) |
| `take_message` tool | **B** | Missing | Full tool + catalog | **Recover** |
| `search_business_knowledge` | **C** | Prompt fallback text | Delegated tool | **Recover** when FileSearch ids empty |
| Google Calendar V3 | **B** | No `calendar/google/*` | Full provider | **Recover** via runtime + compile + dispatch merge |
| Qualification hardening | **A** | Same as gap | — | No change |
| REQUEST_ONLY / SEND_LINK | **A** | On master | — | No rebuild |
| Post-call webhooks / knowledge gaps / digest email | **C** | Partial (notifications in-call) | Full `post-call/*` tree | **Deferred** — avoid duplicating master call-history; optional follow-up |
| Calendly V3 FIND/BOOK | **E** | Not supported | Not supported on gap | **Do not implement** |
| Agent Quality Studio | **E** | Stub | Stub | **Do not revive** |
| Callback SLA | **C** | Job + metadata patch on gap | Partial product promise | **Recover** persist metadata; ops enforcement TBD |
| Waterfall / warm transfer | **C** | Partial | Partial | **Inspect delta** — no wholesale replace |
| Final-completion intake prompt (`f2b3f82b`) | **B** | Missing | 7-commit delta | **Cherry-pick** prompt/tests |
| Final-completion crawl/billing/forensics guards (`55e48438`) | **D/C** | Master has newer crawl/forensics | Overlap | **Do not blind replay** — compare per file |

---

## Phase 2 — Protected master surfaces (do not replace)

1. `src/lib/voice-v3/call-history/post-call-pipeline.ts` and recording/transcript/summary path  
2. `src/lib/voice-v3/knowledge/resolve-agent-knowledge-retrieval.ts` + `useGptLiveFileSearchRag()`  
3. `src/lib/voice-v3/config/demo-config-fallback.ts` (fail-closed ACTIVE agents)  
4. `src/lib/voice-v3/telemetry/call-forensics.ts` usage in LiveKit bridge  
5. `persist-booking-after-confirmation.ts` on successful book  

---

## Phase 3 — Integration branch

`cursor/voice-v3-reconcile-gap-to-master-2304` from current `master`, targeted file recovery (not wholesale merge).

---

## Phase 4 — Final-completion delta

Cherry-pick: `f2b3f82b` (Astra intake prompt).  
Skip wholesale `55e48438` unless file-level diff shows a gap vs master.

---

## Phase 5 — Explicitly out of scope

Calendly V3, Quality Studio, wizard redesign, architecture swap, replacing GPT-Live + Sol delegation.

---

## Phase 6 — Post-integration connectivity taxonomy

Use statuses: **WORKING**, **WORKING / EXTERNAL SETUP REQUIRED**, **BUILT / NEEDS PSTN CERTIFICATION**, **PARTIAL**, **DISPLAY ONLY**, **GENUINELY NOT IMPLEMENTED**, **DEFERRED / HIDDEN**.

See `docs/VOICE-V3-GAP-RECONCILIATION-REPORT.md` for integrated candidate status.
