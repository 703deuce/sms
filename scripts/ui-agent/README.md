# Visual UI Agent (Kimi)

Repo-local development tool that compares **reference screenshots/videos** and **current Transovo rendered UI** against existing page code, then proposes or applies **UI-only** changes.

Kimi is the visual reasoning layer. Cursor/the repo scripts are the engineering layer.

## Requirements

```bash
export KIMI_API_KEY=your_key
export KIMI_API_BASE_URL=https://api.moonshot.ai/v1   # optional
export KIMI_UI_MODEL=kimi-k3                          # optional; must support video for video jobs
```

Optional capture auth (dev/test only):

```bash
export UI_AGENT_SMOKE_EMAIL=...
export UI_AGENT_SMOKE_PASSWORD=...
export UI_AGENT_BASE_URL=http://localhost:3000
```

Never commit API keys or reference media.

## Commands

```bash
# Analyze only — no file changes (default for improve is plan-only)
npm run ui:analyze -- \
  --target "/conversations" \
  --reference-image "./ui-reference/inbox.png"

# Plan improvements (default — does not apply)
npm run ui:improve -- \
  --target "/conversations" \
  --reference-video "./ui-reference/inbox.mov" \
  --capture-current \
  --instruction "Match layout polish but keep Transovo branding and functionality"

# Apply after reviewing .ui-agent/reports/latest.md
npm run ui:improve -- \
  --session "<session-id>" \
  --apply

# Capture current Transovo page and/or reference URL
npm run ui:capture -- --target "/conversations" --screenshots --video-capture

# Validate a session's touched files
npm run ui:validate -- --session "<session-id>"

# Certification (no API key required for structural checks)
npm run test:ui-agent-cert
```

## Workflow

1. Put reference media locally (gitignored): `ui-reference/conversations.mov`
2. Run plan-only improve with `--capture-current`
3. Review `.ui-agent/reports/latest.md`
4. Apply with `--session <id> --apply`
5. Tool validates protected paths, runs lint/tsc, and records the session

## Architecture

| Module | Role |
|--------|------|
| `kimi-client.ts` | `UiVisionProvider` — Kimi multimodal API (images base64, videos via Files API `ms://`) |
| `project-context.ts` | Resolve route → files, compact manifest |
| `capture-current.ts` | Playwright screenshots/video of current Transovo or reference URLs |
| `visual-analysis.ts` | Pass 1 reference analysis, Pass 2 difference plan |
| `change-plan.ts` | Validate plans, write reports |
| `apply-plan.ts` | Apply only allowed presentation paths |
| `path-guards.ts` | Protected vs allowed paths |
| `git-safety.ts` | Dirty tree detection, snapshots, rollback |

## Safety boundaries

**May modify:** `src/app/**` pages, `src/components/**`, styles, presentation state

**Must NOT modify:** `src/lib/**`, `src/app/api/**`, `prisma/**`, providers, auth, billing, MCTB runtime, etc.

If backend work is needed, Kimi reports `backendChangesRequired` — the agent does not fake it.

## Video support

- Uses native Kimi video via Files API when `KIMI_UI_MODEL` supports video (e.g. `kimi-k3`)
- Fails clearly for models that do not support video (e.g. `k3-256k`)
- Does **not** silently substitute frame sampling as full-video understanding

## Reference library

```
.ui-agent/
  references/<name>/metadata.json
  sessions/<session-id>/
  reports/latest.md
```

Use `--reference-name slicktext-inbox` to reuse saved references.

## Certification

```bash
npm run test:ui-agent-cert
```

Verifies path guards, protected-path rejection, dry-run apply, and manifest resolution.

Do **not** use major production pages for the first destructive apply test — use `src/components/ui-agent-cert/SafePresentationDemo.tsx`.
