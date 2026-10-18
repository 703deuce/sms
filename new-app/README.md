# Transovo `new-app` (isolated product UI)

This is the **canonical home** for the next Transovo application shell and UI. It was seeded from `transovo-ui-blueprint/` (UI blueprint) and runs **independently** of the legacy SMS platform at the repository root.

## Quick start

```bash
cd new-app
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100) (port **3100** avoids clashing with the legacy app on **3000**).

```bash
pnpm build
pnpm start
pnpm typecheck
```

## Isolation

| | Legacy SMS (repo root) | `new-app` |
|--|------------------------|-----------|
| Dependencies | Root `package.json` | `new-app/package.json` + `pnpm-lock.yaml` |
| Next routes | `src/app` | `new-app/app` |
| Build | Root `npm run build` | `cd new-app && pnpm build` only |

Do **not** import from `../../src` or root layouts/middleware. Reuse legacy behavior by **copy/adapt** when needed.

## Cursor

**File → Open Folder → `new-app`** for day-to-day work so AI context stays in this app.

## Source

UI routes and components live under `app/app/*` (authenticated shell), `components/*`, and mock data in `lib/data.ts`. Wire to real APIs in later passes.

The reference copy at `transovo-ui-blueprint/` may remain in the repo until the team deletes it; **`new-app` is what ships in the new container.**
