# Visual UI Agent (Kimi)

Repo-local tool: **Kimi builds a complete visual reference** → **you approve it** → **Cursor integrates into production**.

## Role split

| Phase | Who | Delivers |
|-------|-----|----------|
| **Build** | Kimi | 0 → 85–95% visual — runnable sandbox UI with mock data |
| **Integrate** | Cursor / `ui:integrate` | 85–95% → production — real hooks, APIs, existing components |

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
              ↓
    compare: approved Kimi render vs production
```

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **Kimi** | Builds runnable React reference in `.ui-agent/generated/` |
| **You** | Preview + approve when it looks right |
| **Cursor / integrate** | Reuses Kimi presentation; wires production data and handlers |

Kimi **never** edits `src/` directly. Integration is a separate `ui:integrate` step.

## Integration philosophy

Kimi's output is the **starting frontend implementation**, not just a design reference.

**Reuse 80–90%** of Kimi's presentation code where practical (JSX structure, classNames, layout, spacing, transitions, modals).

**Refactor freely** when integrating:
- Replace Kimi local state with existing production hooks
- Merge Kimi JSX into **existing** production components instead of creating parallel `Reference*` components
- Use design-system primitives, routing, accessibility, and performance improvements

**Do NOT** preserve Kimi code line-for-line. Example: keep Kimi's sidebar layout but swap `useState("all")` for `useConversationFilters()`.

**Goal:** Kimi-created visual result + Transovo production functionality.

**Final visual check:** compare the **approved Kimi sandbox screenshot** against **production after integration** — not the original competitor video.

Full prompt text: `INTEGRATION_PRINCIPLES` in `scripts/ui-agent/config.ts`.

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

# 3. Freeze when satisfied (approved render becomes visual target)
npm run ui:approve -- --session "<session-id>"

# 4. Plan production integration (functional mapping report)
npm run ui:integrate -- --session "<session-id>"

# 5. Apply to production src/ + run Kimi-vs-production visual comparison
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
  screenshot.png        # approved visual target (after refinement)
  APPROVED.json         # frozen approval metadata
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
