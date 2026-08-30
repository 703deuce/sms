# Visual UI Agent (Kimi)

Repo-local tool: **Kimi builds a complete visual reference** → **you approve it** → **Cursor integrates into production**.

```
Reference media + current Transovo capture
              ↓
         KIMI builds
              ↓
.ui-agent/generated/<session>/   ← sandbox (mock data OK)
              ↓
    preview → approve → integrate
              ↓
         src/ (real hooks/APIs)
```

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **Kimi** | Builds runnable React reference in `.ui-agent/generated/` |
| **You** | Preview + approve when it looks right |
| **Cursor / integrate** | Transplants presentation into `src/` with real data |

Kimi **never** edits `src/` directly. Integration is a separate `ui:integrate` step.

## Commands

```bash
export KIMI_API_KEY=...
export KIMI_UI_MODEL=kimi-k3   # video-capable; not k3-256k

# 1. Kimi builds reference (auto-captures current page)
npm run ui:improve -- \
  --target "/conversations" \
  --reference-video "./ui-reference/inbox.mov" \
  --capture-current \
  --instruction "Match inbox layout; keep Transovo branding"

# 2. Preview sandbox reference (local only, port 5174)
npm run ui:preview -- --session "<session-id>"

# 3. Freeze when satisfied
npm run ui:approve -- --session "<session-id>"

# 4. Plan production integration (functional mapping report)
npm run ui:integrate -- --session "<session-id>"

# 5. Apply to production src/
npm run ui:integrate -- --session "<session-id>" --apply
```

### Capture helpers

```bash
npm run ui:capture -- --target "/conversations" --screenshots --video-capture
npm run ui:reference -- --reference-url "https://example.com/inbox"
```

## Sandbox structure

```
.ui-agent/generated/<session-id>/
  page.tsx              # ReferencePage — mock data OK
  components/
  mock-data.ts          # NEVER copy to src/
  reference.css
  screenshot.png        # after refinement
  APPROVED.json         # frozen visual source of truth
```

## Safety

- **Sandbox** (`.ui-agent/generated/**`): mock data, fake handlers allowed
- **Production** (`src/`): real hooks/APIs only; integration rejects `mock-data` imports
- Protected: `src/lib/**`, `src/app/api/**`, `prisma/**`, providers, auth, billing
- No auto-commit, push, or deploy

## Certification

```bash
npm run test:ui-agent-cert
```

## Env

See `.env.example` — `KIMI_API_KEY`, `KIMI_UI_MODEL`, `UI_AGENT_SMOKE_EMAIL` (capture auth).
