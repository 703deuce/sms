# Visual UI Agent (Kimi)

**Cursor orchestrates Kimi.** The user talks to Cursor; Cursor invokes the repo-local Kimi tool.

## Daily workflow

```
1. Upload reference once → /dev/ui-references (name: slicktext-inbox)
2. Tell Cursor: "Use Kimi with slicktext-inbox to redo /conversations"
3. Cursor runs: npm run ui:kimi -- --target /conversations --video slicktext-inbox
4. Preview: /dev/ui-studio/preview/<session>  (Current | Kimi | Split)
5. Approve: npm run ui:approve -- --session <id>
6. Cursor integrates via npm run ui:integrate
7. Compare approved Kimi vs production
```

## Commands

```bash
# Primary — Cursor invokes this
npm run ui:kimi -- \
  --target "/conversations" \
  --video "slicktext-inbox" \
  --instruction "Match inbox; keep our sidebar and functionality"

# Revise same session
npm run ui:kimi -- --session <id> --revise --instruction "Tighten row spacing"

# List saved references
npm run ui:refs
npm run ui:refs -- --show slicktext-inbox

# Local file (before uploading to library)
npm run ui:kimi -- --target "/campaigns" --video-file "./ref.mov"

# Approve + integrate
npm run ui:approve -- --session <id>
npm run ui:integrate -- --session <id>
npm run ui:integrate -- --session <id> --apply
```

## Dev UI (not in production)

| Route | Purpose |
|-------|---------|
| `/dev/ui-references` | Upload/name reference videos & images → Supabase + `references.json` |
| `/dev/ui-studio/preview/[sessionId]` | Current / Kimi / Split comparison |

Set `ALLOW_UI_STUDIO=1` to enable in production (not recommended).

## Architecture

| Layer | Role |
|-------|------|
| **User** | Talks to Cursor only |
| **Cursor** | Orchestrates Kimi CLI, integrates, tests |
| **Kimi** | Generates sandbox UI (0→85–95% visual) |
| **Integration** | Cursor reuses presentation + real hooks (85–95%→100%) |

**Kimi never scaffolds a new Next.js project.** It outputs only `page.tsx`, `components/**`, `mock-data.ts`, `reference.css` under `.ui-agent/generated/<session>/`.

## Reference library

Manifest: `.ui-agent/references.json`

```json
{
  "slicktext-inbox": {
    "type": "video",
    "storage": "supabase",
    "bucket": "ui-references",
    "path": "videos/slicktext-inbox.mp4"
  }
}
```

Supabase bucket: `ui-references` (private). Env: `SUPABASE_UI_REFERENCES_BUCKET`.

## Session artifacts

```
.ui-agent/sessions/<session-id>/
  session.json
  input.json
  environment.json
  current/
  HANDOFF.json          # after approve — Cursor reads this
  HANDOFF.md

.ui-agent/generated/<session-id>/
  page.tsx
  components/
  mock-data.ts
  screenshot.png
  APPROVED.json
```

## Integration philosophy

See `INTEGRATION_PRINCIPLES` in `scripts/ui-agent/config.ts`.

Kimi output = starting frontend implementation. Reuse 80–90% presentation; refactor state/handlers for production.

Final visual check: **approved Kimi screenshot** vs **production** — not the original competitor video.

## Video delivery

Videos are **never** base64-embedded in prompts. Pipeline:

```
Supabase ui-references → download to .ui-agent/cache/
  → Kimi POST /v1/files (purpose=video)
  → ms://<file_id> in chat request
  → kimi-k3 (video-capable)
```

- Default max: **100MB** (`KIMI_MAX_VIDEO_BYTES` env override)
- Upload cache avoids re-uploading the same file during refinement passes
- Screenshots only for current-page captures (compact data URLs)

See `VIDEO_DELIVERY_PRINCIPLES` in `scripts/ui-agent/config.ts`.

## Certification

```bash
npm run test:ui-agent-cert
```

## Env

- `KIMI_API_KEY`, `KIMI_UI_MODEL` (use `kimi-k3` for video)
- `UI_AGENT_SMOKE_EMAIL` / `UI_AGENT_SMOKE_PASSWORD` (page capture auth)
- Supabase for reference uploads (optional — use `--video-file` locally without it)
