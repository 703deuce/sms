# Dev environment weight — diagnosis (MCTB + Voice focus)

**Date:** 2026-09-25  
**Audience:** Local dev, Cursor Cloud Agent VMs, anyone wondering why `next dev` “crashes” while production is fine.

## Short answer

| Environment | Healthy? | Typical web memory |
|-------------|----------|-------------------|
| **Coolify production** (`transovo.ai`) | Yes | ~**388 MiB** per web container |
| **Cloud Agent / heavy local VM** | Often **no** | **`next-server` 10–15+ GiB RSS**, ~0 swap |

Production is not the problem. **Development** stacks a monolithic Next app, a huge `.next` cache, parallel agent workflows (screenshots, `next build`, multiple `next dev` tmux sessions), and **no swap** on a 16 GiB VM — that produces OOM kills and `ERR_CONNECTION_REFUSED` when the dev server dies mid-capture.

Hiding products in nav (`v1-launch-nav.ts`) **does not** shrink what Next compiles; it only hides links.

---

## Evidence (this repo / VM)

- **~489** `page.tsx` routes under `src/app/` — full product surface (MCTB, Voice V3, Appointments, Mass SMS, Kimi, campaigns, etc.).
- **`node_modules` ~2 GiB**; **`.next` cache can grow to tens of GiB** (e.g. ~48 GiB after many dev sessions, builds, and screenshot runs).
- **Single `next dev` process** has been observed at **~14.4 GB RSS** (~88% of 15 GiB RAM) on Cloud VMs.
- **Stale processes** left running: Playwright + `capture-transovo-product-redesign.ts`, old `test-voice-v3-*` scripts, **many tmux sessions** (`mctb-dev-server`, `next-dev-*`, `prod-build`, `screenshot-*`, `visual-audit-capture`, …).
- **Coolify SSH (read-only):** web container `ds8s3hjin60qs6g7s0iqkixs-*` **Up**, **~388 MiB**, logs show normal MCTB TeXML traffic — no prod OOM pattern.

---

## Why it feels “so heavy” though you only use MCTB + AI voice

1. **One Next app owns everything** — API routes, Prisma, BullMQ, LiveKit, OpenAI realtime, appointments, campaigns, etc. Visiting `/mctb/*` or `/voice/*` still pulls shared layout, auth, and large dependency trees (`serverExternalPackages` in `next.config.ts` is a hint of weight).
2. **Dev compiles on demand** — first hit (and refactors) compile large graphs; Turbopack is not the default script (`npm run dev` → `next dev` only).
3. **Agents amplify load** — `next build` (3 GiB heap cap in `package.json`), full-route Playwright, Kimi batch jobs, and **second `next dev`** on another port are common; together they exceed 16 GiB.
4. **`.next` never shrinks by itself** — failed builds and dev caches accumulate on disk and in memory until the process is restarted or `.next` is removed.

---

## What to do (keep all code — nothing deleted)

### Hygiene (immediate, no architecture change)

1. **One dev server** — pick one tmux session (e.g. `ui-dev-light` or `mctb-dev-server`); stop extras (`next-dev-voice`, duplicate `next dev` on other ports).
2. **Kill orphaned capture/test** — no long-running `capture-*.ts` or Playwright after the run finishes.
3. **Reset dev cache when sluggish** — from repo root:
   ```bash
   npm run dev:clean
   ```
   (Stops nothing automatically; removes `.next` then starts `next dev` — run only when you can restart dev.)
4. **Do not use production build for UI review** on the agent VM — use `docs/TRANSOVO-LIGHTWEIGHT-SCREENSHOT-WORKFLOW.md` (`--route` / `--group`, concurrency 1).
5. **Cloud VM:** avoid `prod-build` tmux + `next dev` + Playwright at the same time.

### Configuration (optional)

- **`NODE_OPTIONS='--max-old-space-size=4096'`** for `next dev` on a 16 GiB machine — caps Node heap so the OS fails earlier with a clear OOM instead of freezing; tune per machine.
- **Production builds** stay on Coolify (8 GiB build VM already uses `COOLIFY_RESOURCE_UUID` mitigations in `next.config.ts`). Local/agents should not mirror full `npm run build` unless certifying.

### Medium term (preserve dormant products)

| Approach | Effect | Code removed? |
|----------|--------|----------------|
| Nav / entitlements (`v1-launch-nav`, feature flags) | UX only | No |
| Lazy `dynamic()` for heavy admin/marketing pages | Smaller initial compile for routes you open | No |
| **`voice-runtime/` separate process** | Voice worker off hot path until needed | No |
| **Route groups / optional “dev entry” env** (future) | Dev middleware could 404 or stub unused prefixes | No — behind flag |
| **Split into multiple Next apps or packages** | Real isolation; highest effort | No — extract, don’t delete |

There is **no** switch today that makes Next dev “MCTB-only” while keeping one repo; the honest fix for compile weight is **lazy imports + fewer parallel jobs**, or **physical split** later.

---

## Production log access (Coolify)

See `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`:

```bash
ssh coolify-server 'docker ps --format "table {{.Names}}\t{{.Status}}"'
WEB=$(docker ps --format "{{.Names}}" | grep ds8s3hjin60qs6g7s0iqkixs | head -1)
docker stats --no-stream $WEB
docker logs --tail 200 $WEB
```

Deployment build failures: query `application_deployment_queues` in `coolify-db` (avoid dumping multi‑MB log blobs into chat).

---

## Agent / contributor rules (recommended)

- **Never** run full-product screenshot batches or `npm run build` for visual polish unless the user explicitly requests certification.
- **One** `next dev` on port 3000; capture with `--route` only.
- After heavy capture sessions, **`dev:clean`** or manual `rm -rf .next` when dev becomes unstable.

---

## Related docs

- `docs/TRANSOVO-LIGHTWEIGHT-SCREENSHOT-WORKFLOW.md`
- `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`
- `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` (nav hiding vs runtime)
