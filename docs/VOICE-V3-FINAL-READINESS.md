# Voice V3 V1 — final code readiness (feature freeze gate)

**Branch:** `cursor/voice-v3-final-completion-2304`  
**Directive:** `docs/VOICE-V3-FINAL-PRODUCT-COMPLETION-DIRECTIVE.md` (four-part final pass)

## Automated readiness (code)

| Area | Status | Evidence |
|------|--------|----------|
| Website crawler + multi-page ingest | DONE | `src/lib/voice-v3/knowledge/website-crawl/*`, job `voice_website_crawl`, API `scan_website` → async crawl |
| Business auto-import suggestions | DONE | `extract-business-suggestions.ts`, stored on `VoiceWebsiteCrawlJob.suggestions` |
| OpenAI vector-store ingest | DONE | `gpt-live-file-search-rag.ts` + crawl indexing |
| Per-call billing ledger | DONE | `VoiceV3UsageEvent`, `record-billable-call.ts`, job `voice_v3_billing_dispatch` |
| Call forensics | DONE | `record-forensic-event.ts`, tool forensics in `execute-voice-tool.ts`, `VoiceCallEvent` + trace |
| Hard-action booking gate | DONE | `authorize-booking-mutation.ts` in `book-dispatch` commit path |
| Objective-pivot safety | PRESERVED + tested | `goal-invalidation.ts`, find/book stale paths |
| Wizard manifest NI | **0** | `test-voice-v3-wizard-manifest-coverage.ts` |

## Test scripts (final pass)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-website-crawl.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-call-billing.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-call-forensics.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-hard-action-gates.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-objective-pivot-safety.ts
```

Plus existing V3 suites listed in `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-REPORT.md`.

## Manual production certification (not code blockers)

Real PSTN + OAuth + FileSearch + billing Stripe meter on tenant — see directive Part 9 and `docs/VOICE-AGENT-NOT-COMPLETED-COPY-PASTE.md` §5.

## Explicitly out of V1 code scope

Calendly V3, CRM, long-term memory runtime, multi-calendar picker, per-service booking-hours engine, contact-center wallboard.
