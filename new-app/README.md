# Transovo `new-app` (isolated Next.js application)

This folder is a **standalone Next.js application** inside the same Git repository as the legacy SMS platform. It does not share the root app’s `src/app` tree, middleware, providers, or build pipeline.

## Quick start

From this directory only:

```bash
cd new-app
npm install
npm run dev
```

Open [http://localhost:3100](http://localhost:3100). Port **3100** avoids clashing with the legacy app’s default **3000**.

Other commands:

```bash
npm run build      # production build (this app only)
npm run start      # serve production build on port 3100
npm run typecheck  # TypeScript, scoped to new-app/src
```

## Cursor workflow

**Everyday work on the new product**

1. **File → Open Folder** → select `new-app` (not the repository root).
2. Run install and dev commands from the integrated terminal with `new-app` as the cwd.

Cursor indexes and searches primarily what is in the open workspace. Keeping the workspace rooted at `new-app` avoids loading the full legacy SMS tree into AI context.

**When you need something from the legacy platform**

1. Open a **second** Cursor window on the **repository root**, or temporarily widen the workspace.
2. Find the feature in root `src/`, APIs, etc.
3. **Copy and adapt** into `new-app/src` — do not add imports from `../../src` or the root package.

Optional: add a `.cursorignore` at the repository root (if your team allows) to exclude `src/` when working from root; this scaffold does not modify root ignore rules.

## Dependency boundaries

| Item | Legacy SMS (repo root) | `new-app` |
|------|------------------------|-----------|
| `package.json` | Root `package.json` | `new-app/package.json` |
| Lockfile | Root `package-lock.json` | `new-app/package-lock.json` |
| Next.js config | Root `next.config.*` | `new-app/next.config.ts` |
| TypeScript | Root `tsconfig.json` (whole monolith) | `new-app/tsconfig.json` (`src/**` only) |
| App routes | Root `src/app` or `app/` | `new-app/src/app` |
| `node_modules` | `/node_modules` | `new-app/node_modules` |

There is **no** npm/pnpm workspace linking the two projects. Root `npm run build` does **not** build `new-app`.

## Reusing legacy code later

1. Inspect the legacy implementation in a separate workspace or window.
2. Copy the minimal files into `new-app/src/`.
3. Replace imports, env vars, and auth with this app’s own layers.
4. Avoid `import ... from '../../../src/...'` — that reconnects the dependency graph and build.

When several apps need the same stable utility, extract a small shared package (future step); this scaffold intentionally does not add Turborepo/Nx.

## Environment

Copy `env.example` to `.env.local`. Variables here are for **new-app** only and are not read by the legacy application unless you duplicate them at the repo root.

## Folder layout

```
new-app/
  package.json
  package-lock.json
  next.config.ts
  tsconfig.json
  eslint.config.mjs
  env.example
  .gitignore
  README.md
  src/
    app/           # App Router entry
    components/    # UI building blocks
    lib/           # Shared logic for this app only
```

## Shared configuration that still connects the projects

- **Git**: one repository and history (intentional).
- **CI/CD**: root pipelines may still clone the whole repo; they only build `new-app` if you add a separate job that `cd new-app && npm ci && npm run build`. This scaffold does not wire that into root `package.json` scripts.
- **Manual imports**: crossing into `../src` breaks isolation — avoid in application code.
