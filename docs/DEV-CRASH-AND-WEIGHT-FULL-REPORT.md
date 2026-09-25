# Dev crashes & weight — full report (copy-friendly)

**Date:** 2026-09-25  
**Context:** You only use **Missed Call Text Back** and the **AI voice agent**, but local dev / Cloud Agent VMs keep crashing and feel very heavy. Production on Coolify was checked via SSH.

---

## Verdict: production is fine; dev / agent VM is what’s crashing

### Coolify (SSH)

- Web app `ds8s3hjin60qs6g7s0iqkixs-*` is **Up**, using about **388 MiB** RAM on a ~7.5 GiB limit.
- Recent logs are normal MCTB TeXML / press-1 traffic — no OOM or restart loop on prod.
- Scheduler container is healthy (~180 MiB).
- Example production map (refresh if stale): repo `703deuce/sms` @ `master`, app UUID `ds8s3hjin60qs6g7s0iqkixs`, health `GET /api/health` on your Coolify primary FQDN (see deployment doc).

So the “keeps crashing” story is **not** your live site; it’s **local / Cursor Cloud dev** on a **16 GiB, no-swap** VM (typical Cloud Agent shape).

### What was killing the Cloud VM (measured 2026-09-25)

| Factor | What we saw |
|--------|-------------|
| **`next-server` (dev)** | ~**14.4 GB RSS** (~88% of RAM) |
| **`.next` on disk** | ~**48 GB** of dev/build cache |
| **App surface** | ~**489** `page.tsx` routes in one Next app |
| **Extra load** | Stale **Playwright** + `capture-transovo-product-redesign.ts` (hours old), old test scripts, **many tmux sessions** (`mctb-dev-server`, `next-dev-*`, `prod-build`, `screenshot-*`, `visual-audit-capture`, `ui-dev-light`, etc.) |
| **After stopping the ~14 GB dev process + orphans** | RAM went from **~179 MiB free → ~14 GiB free** |

**Typical failure mode:** agents (or humans) run **`next dev` + `next build` + full-route screenshots** together → memory exhaustion → dev server dies → `ERR_CONNECTION_REFUSED` mid-capture. That looks like “the app is broken” but it’s **OOM on the VM**.

### Short comparison table

| Environment | Healthy? | Typical web memory |
|-------------|----------|-------------------|
| **Coolify production** (primary FQDN) | Yes | ~**388 MiB** per web container |
| **Cloud Agent / heavy local VM** | Often **no** | **`next-server` 10–15+ GiB RSS**, ~0 swap |

Production is not the problem. **Development** stacks a monolithic Next app, a huge `.next` cache, parallel agent workflows (screenshots, `next build`, multiple `next dev` tmux sessions), and **no swap** on a 16 GiB VM — that produces OOM kills and connection refused when the dev server dies mid-capture.

**Hiding products in nav (`src/lib/products/v1-launch-nav.ts`) does not shrink what Next compiles; it only hides links.**

---

## Why it feels huge when you only use MCTB + AI voice

1. **One monolithic Next app** still bundles MCTB, Voice V3, appointments, mass SMS, Kimi, workers, LiveKit, BullMQ, OpenAI realtime, campaigns, etc.
2. **`v1-launch-nav.ts` only hides nav** — it does **not** stop Next from compiling shared layout, APIs, and whatever you touch on a route.
3. **Production** runs a **compiled standalone** image (~3.9 GB virtual image, ~400 MiB runtime). **Dev** keeps graphs, HMR, and a growing `.next` tree in memory and on disk.
4. **Dev compiles on demand** — first hit (and refactors) compile large graphs; `npm run dev` is `next dev` only (no Turbopack in package.json by default).
5. **Agents amplify load** — `npm run build` uses `NODE_OPTIONS=--max-old-space-size=3072`; full-route Playwright, Kimi batch jobs, and a **second `next dev`** on another port are common; together they exceed 16 GiB.
6. **`.next` never shrinks by itself** — failed builds and dev caches accumulate on disk and in memory until the process is restarted or `.next` is removed.

You can **keep all code** for later products; the weight is **architecture + dev workflow**, not “unused files you must delete.”

---

## Evidence (this repo / VM)

- **~489** `page.tsx` routes under `src/app/` — full product surface (MCTB, Voice V3, Appointments, Mass SMS, Kimi, campaigns, etc.).
- **`node_modules` ~2 GiB**; **`.next` cache can grow to tens of GiB** (e.g. ~48 GiB after many dev sessions, builds, and screenshot runs).
- **Single `next dev` process** observed at **~14.4 GB RSS** (~88% of 15 GiB RAM) on Cloud VMs.
- **Stale processes** left running: Playwright + `scripts/capture-transovo-product-redesign.ts`, old `test-voice-v3-*` scripts, many tmux sessions.
- **Coolify SSH (read-only):** web container `ds8s3hjin60qs6g7s0iqkixs-*` **Up**, **~388 MiB**, logs show normal MCTB TeXML traffic — no prod OOM pattern.
- **`next.config.ts`:** `output: "standalone"`, large `serverExternalPackages` (bullmq, livekit, openai, ws, etc.); Coolify build uses `COOLIFY_RESOURCE_UUID` mitigations (skip TS during build, webpack memory opts).

---

## Practical cut-down (nothing deleted)

### Immediate hygiene

1. **One** `next dev` on port 3000 — shut duplicate tmux dev sessions (`next-dev-voice`, `next-dev-server`, extra copies).
2. Don’t leave **capture / Playwright** running after a run (`capture-*.ts`, `ui:capture*`, product redesign capture scripts).
3. When dev gets sluggish or RAM is gone:
   ```bash
   npm run dev:clean
   ```
   This removes `.next` and starts `next dev` again. Run only when you can restart dev. On disk-heavy VMs you can also:
   ```bash
   rm -rf .next
   ```
   then `npm run dev` — can reclaim tens of GB.
4. **Never** use `npm run build` for UI screenshots / visual polish on a dev VM — use lightweight capture (see below).
5. **Cloud VM:** do not run `prod-build` tmux + `next dev` + Playwright at the same time.
6. Kill orphaned capture/test PIDs if they linger (example: `capture-transovo-product-redesign.ts`, old `test-voice-v3-booking-persistence.ts`).

### Optional configuration

- **`NODE_OPTIONS='--max-old-space-size=4096'`** for `next dev` on a 16 GiB machine — caps Node heap so failure is clearer; tune per machine.
- **Production builds** stay on Coolify. Local/agents should not mirror full `npm run build` unless certifying release.

### Medium term (preserve dormant products — still reversible)

| Approach | Effect | Code removed? |
|----------|--------|----------------|
| Nav / entitlements (`v1-launch-nav`, feature flags) | UX only | No |
| Lazy `dynamic()` for heavy admin/marketing pages | Smaller compile for routes you actually open | No |
| **`voice-runtime/` separate process** | Voice worker off hot path until needed | No |
| **Route groups / optional “dev entry” env** (future) | Dev middleware could 404 or stub unused prefixes | No — behind flag |
| **Split into multiple Next apps or packages** | Real isolation; highest effort | No — extract, don’t delete |

There is **no** switch today that makes Next dev “MCTB-only” while keeping one repo. Honest fixes: **lazy imports + fewer parallel jobs**, or **physical split** later.

**Optional next engineering step:** scoped **lazy-import pass** on worst offenders (campaigns, Kimi admin, appointments builder) so `/mctb` and `/voice` cold starts compile less — without deleting any product code.

---

## Production log access (Coolify)

Full workflow: `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`

SSH alias: `coolify-server` → `root@128.140.102.51` (key from `COOLIFY_SSH_KEY` — never print the key).

```bash
ssh coolify-server 'docker ps --format "table {{.Names}}\t{{.Status}}"'
WEB=$(docker ps --format "{{.Names}}" | grep ds8s3hjin60qs6g7s0iqkixs | head -1)
ssh coolify-server "docker stats --no-stream $WEB"
ssh coolify-server "docker logs --tail 200 $WEB"
```

Deployment build failures: query `application_deployment_queues` in Postgres `coolify-db` on the server — extract the **first root error**, don’t dump multi‑MB log rows into chat.

Correlate deploy:

```bash
curl -sS "$PRODUCTION_BASE_URL/api/health"
# commitSha should match git push SHA; PRODUCTION_BASE_URL from Coolify FQDN
```

---

## Lightweight screenshots (do not use production build)

Doc: `docs/TRANSOVO-LIGHTWEIGHT-SCREENSHOT-WORKFLOW.md`

Rules:

- One running dev server on port 3000.
- Capture **one route or small group** at a time (`scripts/capture-pass-3-visual-proof.ts` with `--route` / `--group`, concurrency 1).
- No `npm run build` for visual review.
- No 20–30 route Playwright marathons on a 16 GiB VM.

Helper (if present): `scripts/capture-quick-desktop.ts`

---

## Agent / contributor rules (also in AGENTS.md)

- **Never** run full-product screenshot batches or `npm run build` for visual polish unless explicitly certifying.
- **One** `next dev` on port 3000; capture with `--route` only.
- After heavy capture sessions: **`npm run dev:clean`** or `rm -rf .next` when dev becomes unstable.
- Nav flags hide products in UI; they **do not** shrink Next’s compile graph.

---

## Repo artifacts from this investigation

| Item | Path |
|------|------|
| Technical diagnosis (shorter) | `docs/DEV-ENVIRONMENT-WEIGHT-DIAGNOSIS.md` |
| **This full copy-friendly report** | `docs/DEV-CRASH-AND-WEIGHT-FULL-REPORT.md` |
| Screenshot workflow | `docs/TRANSOVO-LIGHTWEIGHT-SCREENSHOT-WORKFLOW.md` |
| Coolify deploy | `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md` |
| Dev clean script | `npm run dev:clean` in `package.json` (`rm -rf .next && next dev`) |
| Controlled visual rollback notes | `docs/TRANSOVO-CONTROLLED-VISUAL-ROLLBACK.md` |

Branch / PR (at time of report): `cursor/pass-3b-full-visual-redesign-2304`, GitHub PR #533 on `703deuce/sms`.

---

## On your own machine

Same playbook:

- One dev server.
- Prune `.next` when the folder is huge (tens of GB).
- Avoid parallel **build + browser automation** unless you have enough RAM and swap.

Production on Coolify should stay ~400 MiB per web container; if prod misbehaves, use the SSH commands above — that’s a different class of problem than dev OOM.
