# Voice Business Knowledge — Implementation Report

## 1. Files changed

- `src/app/(app)/voice/knowledge/page.tsx` — hosts `BusinessKnowledgeEditor`
- `src/components/voice/knowledge/business-knowledge-editor.tsx` — permanent customer workspace
- `src/components/voice/dependency-row.tsx` — shared with Receptionist
- `src/components/voice/call-handling-operational-page.tsx` — read-only hours summary
- `src/components/voice/receptionist/voice-receptionist-editor.tsx` — uses shared `DependencyRow`
- `src/components/voice/knowledge-gaps-panel.tsx` — gap resolve UX + processing errors
- `src/lib/solutions/appointment-receptionist/knowledge-editor-persist.ts`
- `src/lib/solutions/appointment-receptionist/knowledge-editor-schedule.ts`
- `src/lib/solutions/appointment-receptionist/knowledge-editor-timezone.ts`
- `src/lib/solutions/appointment-receptionist/knowledge-items-helpers.ts`
- `src/lib/voice/knowledge/source-status-label.ts`
- `src/lib/voice/knowledge/website-crawl-customer-status.ts`
- `src/lib/voice-v3/knowledge-gaps/resolve-gap-with-indexing.ts`
- `src/lib/voice-v3/knowledge-gaps/owner-service.ts`
- `src/app/api/voice/knowledge-gaps/route.ts`
- `src/app/api/voice/knowledge/crawl/latest/route.ts`
- `src/app/api/voice/knowledge/crawl/[jobId]/route.ts` — PATCH dismiss
- `src/lib/solutions/appointment-receptionist/knowledge-editor.test.ts`
- `docs/VOICE-BUSINESS-KNOWLEDGE-IMPLEMENTATION-REPORT.md`

## 2. Final page structure

`mx-auto max-w-5xl px-4 sm:px-6 pb-24` with `space-y-8` sections: Status → Core facts → Hours → Website → FAQs → Sources → Unanswered questions.

## 3. Component reuse

`PageHeader`, `VoiceSubNav`, `Card`, `Button`, `Input`, `Label`, `Textarea`, `Table`, `InfoCallout`, `BusinessScheduleEditor`, `KnowledgeGapsPanel`, `DependencyRow` (Call Handling).

## 4. Core fact persistence

`POST /api/solutions/appointment-receptionist` with `wizardStepId: "information"`; `syncCompanyBrainFromWizard` unchanged on server.

## 5. Hours persistence

Same API with `wizardStepId: "call-handling"`; full wizard state sent; merge preserves unrelated call-handling fields (tested).

## 6. Timezone synchronization

On schedule save: `mirrorTimezoneFromBusinessSchedule` sets `state.timezone` = `businessSchedule.timezone` (one-way). **No `compileVoiceV3AgentConfig` change** — mirror is sufficient for current readers.

## 7. Hours prose compatibility

Structured schedule drives displayed hours via `compileBusinessHoursAmyDisplay`; optional “Customize how Amy describes these hours” for `knowledgeItems[hours]`; `syncHoursKnowledgeItemFromSchedule` writes derived prose into hours item on schedule save for Brain/MCTB sync path.

## 8. Website workflow

Save URL (information save) + `scan_website` on existing knowledge API; poll latest crawl job; customer status mapping in `website-crawl-customer-status.ts`.

## 9. Crawl status implementation

`GET /api/voice/knowledge/crawl/latest?knowledgeBaseId=`; polling while `DISCOVERING`/`CRAWLING`.

## 10. Suggestion approval

Reads `VoiceWebsiteCrawlJob.suggestions`; approve writes `knowledgeItems` + information save.

## 11. Suggestion dismissal

`PATCH /api/voice/knowledge/crawl/[jobId]` stores `_dismissed` keys inside existing `suggestions` JSON (no schema migration).

## 12. Source management

Reuses KB CRUD/upload/reindex/delete APIs; customer status labels; mobile-stacked table rows.

## 13. Gap indexing fix

`resolveVoiceKnowledgeGapWithIndexing`: create `pending` source → `processKnowledgeSource` → verify `indexed` → only then `RESOLVED`. On failure gap stays `OPEN`, API 422.

## 14. Gap failure/retry

UI shows error + keeps question open; user can retry resolve; optional reindex on source from sources list.

## 15. Company Brain compatibility

No direct Brain writes; appointment-receptionist save path preserved.

## 16. MCTB protection

Brain sync still driven by wizard save; no MCTB code changes.

## 17. Call Handling duplicate-editor removal

`BusinessScheduleEditor` removed; `DependencyRow` → `/voice/knowledge#hours`.

## 18. First-run wizard treatment

`InformationStep` still includes `BusinessScheduleEditor` for onboarding (unchanged).

## 19. Publish/live semantics

Region saves show “Saved”; publish banner links to `/voice/receptionist`; sources use “Ready for search” when indexed.

## 20. Responsive

Single column, stacked source rows on narrow screens.

## 21. Accessibility

H1/H2 hierarchy, labels, confirm on delete, `aria-live` on website status.

## 22. Tests and results

`npx vitest run src/lib/solutions/appointment-receptionist/knowledge-editor.test.ts` — timezone mirror, merge preservation, crawl mapping, source labels.

Gap resolve indexing: covered by implementation review of `resolve-gap-with-indexing.ts` (server-only module; no unit harness without full DB mock).

## 23. Runtime/compiler files changed

**None.** `compileVoiceV3AgentConfig` not modified.

## 24. Deferred items

- Open gap count in status strip (requires gaps API in parent)
- Edit-then-approve modal for website suggestions (approve as-is only in v1)
- Advanced “Preview search” behind disclosure

## 25. Owner certification list

- Load `/voice/knowledge` cold; save facts and hours; verify Call Handling summary link
- Scan website; confirm searchable vs review copy
- Resolve gap; confirm source becomes indexed and gap closes
- Publish from Receptionist; PSTN smoke for hours + facts
- MCTB lead recovery FAQ still receives Brain fields after BK save

---

BUSINESS KNOWLEDGE IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED
