# Voice V3 — Business Auto-Setup + Knowledge — Repository Audit

Date: 2026-09-20  
Scope: Appointment Receptionist wizard, public business acquisition, knowledge compilation.

## ScrapingDog / Local SEO Express / Review Velocity

| Finding | Detail |
|--------|--------|
| **ScrapingDog in this repo** | **Not present.** No `scrapingdog`, `SCRAPINGDOG_*`, `google_maps`, `place_id`, `data_id`, or `ludocid` references in `/workspace`. |
| **Local SEO Express** | Referenced only in comments (Supabase env parity, Twilio ISV doc). No scraping module shipped in this tree. |
| **Review Velocity** | No implementation found. |
| **Bright Data** | Not present. |

**Implementation choice:** Add a single shared client at `src/lib/scrapingdog/client.ts` using env **`SCRAPINGDOG_API_KEY`** (documented in `.env.example`). When Local SEO Express code is merged into this monorepo, point that product at the same client/env — do **not** add `SCRAPINGDOG_VOICE_API_KEY` or a second integration.

## Other acquisition / scraping paths (reused)

| Provider / path | Location | Purpose | Env | Fit for auto-setup |
|-----------------|----------|---------|-----|-------------------|
| Direct `fetch` | `src/lib/voice/knowledge-processor.ts`, `information-step` → `scan_website` | Single URL preview + Telnyx RAG crawl | — | **Primary** for website (extend with SSRF + multi-page) |
| Telnyx RAG URL crawl | `src/lib/voice/telnyx/rag.ts` | Embed URL for document Q&A | Telnyx | Composable RAG; **not** wizard field extraction |
| SSRF guard | `src/lib/voice/url-safety.ts` | `assertSafeWebhookUrl` | — | **Reuse** for business import fetch |
| Company Brain | `/api/company-brain`, `hydrate-from-brain.ts` | Hire Amy brain → wizard patch | — | Parallel path; auto-setup **does not** replace brain |
| Job queue | `voice_knowledge_process` in `job-handlers.ts` | Async KB processing | — | Pattern for `voice_v3_business_import` |

## Appointment Receptionist wizard (authoritative fields)

Source: `AppointmentReceptionistWizardState` in `src/lib/solutions/appointment-receptionist/types.ts`.

| Category | Wizard fields / structures |
|----------|---------------------------|
| Identity | `businessName`, `agentName`, `role`, `websiteUrl`, `timezone` |
| Knowledge items | `knowledgeItems[]` — ids: `business`, `hours`, `services`, `pricing`, `faqs`, `policies` (+ optional `service_area` in prompt compiler) |
| Structured hours | `operatingMaturity.businessSchedule` (via `operating-maturity` types) |
| Bookable services | `appointmentTypes[]` (`name`, `description`, `durationMin`, …) |
| Phone (inbound) | `phoneNumberE164` (not from public scrape by default) |
| Transfer / emergency | `urgencyRules`, `transferTriggers`, capabilities |

Default knowledge item shells: `src/lib/solutions/appointment-receptionist/defaults.ts`.

## Knowledge → Voice V3 runtime

| Layer | Location |
|-------|----------|
| Wizard → V3 config | `hotContextFromWizard` in `compile-voice-v3-agent-config.ts` |
| Prompt knowledge block | `buildBusinessKnowledgePromptSection` / `buildCompactBusinessSections` in `src/lib/voice/prompt/build-business-context.ts` |
| Approved-only filter | `approvedKnowledgeItems` — excludes `extracted`, `rejected`, `pending_review`, `missing` |
| RAG (optional) | `linkedKnowledgeBaseId`, `processKnowledgeSource` — separate from wizard summaries |

**No vector RAG required** for typical local-business knowledge size; compiled approved facts + structured hours suffice unless measurement proves overflow.

## Existing website scan (gap)

`POST /api/voice/knowledge` `action: "scan_website"`:

- Normalizes URL with `https://` only (no SSRF).
- One URL → KB source; not multi-page business extraction.
- No Google Maps.
- No review/diff/merge with wizard.

Auto-setup **extends** with a dedicated import pipeline; wizard remains authoritative after apply.

## Data models (existing)

- `VoiceKnowledgeBase` / `VoiceKnowledgeSource` — document RAG, not import candidates.
- `SolutionSetup.configJson` — durable wizard storage via appointment-receptionist save path.

## New models (this feature)

See `VoiceV3BusinessKnowledgeSource` and `VoiceV3BusinessKnowledgeImport` in Prisma — import snapshots, candidates, diff/review JSON; wizard state unchanged until user applies.

## Security baseline

- Reuse `assertSafeWebhookUrl` pattern for all crawl fetches.
- Treat page text as untrusted data in LLM extraction prompts.
- Server-only ScrapingDog key; Maps search/details via API routes only.

## Tests to add

- Deterministic diff/merge (`scripts/test-voice-v3-business-import-diff.ts`)
- API auth + tenant isolation (follow `requireSession` patterns)
- Browser flows per directive §69–80 (manual / computer-use)
