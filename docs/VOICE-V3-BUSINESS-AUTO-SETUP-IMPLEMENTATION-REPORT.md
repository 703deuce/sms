# Voice V3 — Business Auto-Setup + Knowledge — Implementation Report

## Repository audit (summary)

See `docs/VOICE-V3-BUSINESS-AUTO-SETUP-AUDIT.md`.

- **ScrapingDog:** not present in this repo before this work; added `src/lib/scrapingdog/client.ts` with **`SCRAPINGDOG_API_KEY`** (`.env.example` updated). Align with Local SEO Express when merged — single client/env.
- **Wizard mapping:** `docs/VOICE-V3-BUSINESS-AUTO-SETUP-WIZARD-MAPPING.md`.
- **Reused:** `assertSafeWebhookUrl`, job queue pattern (`voice_knowledge_process`), `loadAppointmentReceptionistSetup`, `hotContextFromWizard` / `buildBusinessKnowledgePromptSection` for runtime knowledge.

## Architecture

```
Public sources (website crawl + Google Maps via ScrapingDog)
  → normalization (JSON-LD + cleaned HTML)
  → LLM structured extraction (candidates only)
  → deterministic diff vs wizard snapshot
  → review UI
  → user apply → draftConfig.advanced.appointmentReceptionistWizard
  → existing save/publish → Voice V3 compiler
```

Import system is **suggestion/diff only**; wizard remains operational truth after apply.

## Provider strategy

1. **DIRECT** — `fetchPublicBusinessPage` with SSRF checks (`safe-fetch.ts` + `url-safety.ts`)
2. **SCRAPINGDOG_STATIC** — `dynamic=false`
3. **SCRAPINGDOG_DYNAMIC** — only when static/direct unusable

Google: `searchGoogleMapsBusinesses` → user selection → `getGoogleMapsPlaceDetails` on refresh.

## Data model

| Model | Role |
|-------|------|
| `VoiceV3BusinessKnowledgeSource` | Per-agent website + Google identifiers |
| `VoiceV3BusinessKnowledgeImport` | Run status, pages, candidates, review JSON, telemetry |

Migration: `prisma/migrations/20260920190000_voice_v3_business_knowledge_import/`

## API (server-only provider)

| Route | Purpose |
|-------|---------|
| `POST /api/voice-v3/business-import/search` | Google business search |
| `PUT /api/voice-v3/business-import/sources` | Save website + selected listing |
| `GET /api/voice-v3/business-import/sources` | Read sources |
| `POST /api/voice-v3/business-import/start` | Enqueue import job |
| `GET /api/voice-v3/business-import/[importId]` | Status + review |
| `POST /api/voice-v3/business-import/[importId]/apply` | Merge selected candidates into wizard draft |

Job type: `voice_v3_business_import` → `runBusinessKnowledgeImport`.

## UI

- `BusinessAutoSetupPanel` on Appointment Receptionist **Information** step.
- Progress labels, review checkboxes, apply selected.

## Deduplication

- **Exact:** normalized string equality (services, names).
- **Semantic:** `normalize-facts.ts` token overlap / substring rules.
- **Arrays:** item-by-item merge in `apply.ts`; no full-array replace.
- **Conflicts:** surfaced as `CHANGED` / `CONFLICT`; never auto-overwrite.

## Knowledge runtime

Approved items use `owner_approved` / `complete` status → existing `buildBusinessKnowledgePromptSection` and `hotContextFromWizard`. Unapproved import JSON is never compiled.

## Security

- SSRF: redirect-safe public fetch.
- Prompt injection: extraction system prompt treats source as data.
- Tenant: all queries scoped by `workspaceId` from session.

## Tests

```bash
npx tsx scripts/test-voice-v3-business-import-diff.ts
npx tsx scripts/test-voice-v3-business-import-scrapingdog.ts
DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL=<user-with-workspace> npx tsx scripts/capture-voice-v3-business-auto-setup.ts
bash scripts/audit-coolify-scrapingdog-env.sh  # requires COOLIFY_SSH_KEY
```

## Production / ops

- **Migration:** `20260920190000_voice_v3_business_knowledge_import` (FK → `voice_agents`). Apply via `npm run db:deploy`.
- **Coolify:** `SCRAPINGDOG_API_KEY` present on web + scheduler containers (audit script lists env names only).

## Not completed in this pass (follow-up)

- Full import → apply → wizard save browser certification with live agent draft, PSTN knowledge calls (§85–88).
- Deletion detection (§31).
- Persist apply into `SolutionSetup.configJson.wizard` on every path (draft apply + `upsertAppointmentReceptionistSetup` on apply route today).
- Production deploy of branch (transovo.ai health SHA until merged).

## Hard stops honored

No GBP OAuth, no client-side ScrapingDog key, no voice tools for scraping, no auto-publish, no blind wizard overwrite, no default JS rendering.
