# Clips / script editor — owner resolve later

**Policy (owner 2026-10-27):** Agents **never stop and wait** on the owner. Use best-practice defaults, **env checks**, or **feature flags**, ship the rest, and **append every external dependency here**.

| ID | What | Why blocked | Agent workaround | Owner action to unblock |
|----|------|-------------|------------------|-------------------------|
| **BLK-003** | **M14 local MediaRecorder E2E on prod** | Needs stable long-run browser + fixture projects | Unit/integration tests + dev manual; prod §D1b **141+** when fixtures deployed | Confirm prod test projects + runbook |
| **BLK-005** | **Coolify deploy lag / health `commitSha`** | Container swap → transient **502/503** on status/notifications | Treat as deploy overlap unless errors persist >15 min post-deploy; check container uptime | None if self-heals after deploy |
| **BLK-006** | **Clipper + Streamer phase 2 (BIC matrix)** | Owner queued until **Descript M4.1–M17** ship | Specs in `docs/clips/clipper/*.md`; screenshots on server `:/opt/transovo-refs/clipper/` | Complete Descript milestones; then implement per BIC + UI layouts |

## How to update

When you add a row, include **date**, **milestone**, and link to code (`lib/server/...`, route, flag name).

**Resolved:** move rows here with date and commit SHA when unblocked.

| ID | Resolved | Notes |
|----|----------|-------|
| **BLK-002** | 2026-10-27 `ui-layouts` delivered | `docs/clips/descript/ui-layouts.md` + `ui-checklist.md`; refs on server `/opt/transovo-refs/descript/` |
| **BLK-004** | 2026-10-27 | Descript reference PNGs on `coolify-server:/opt/transovo-refs/descript/` (not in repo) |
