# Clips / script editor — owner resolve later

**Policy (owner 2026-10-27):** Agents **never stop and wait** on the owner. Use best-practice defaults, **env checks**, or **feature flags**, ship the rest, and **append every external dependency here**.

| ID | What | Why blocked | Agent workaround | Owner action to unblock |
|----|------|-------------|------------------|-------------------------|
| **BLK-001** | LiveKit Cloud **Rooms / SFU** (M15–M16) | No `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` in Coolify yet | Implement per `livekit-api-brief.md` behind `isLiveKitConfigured()` / `getLiveKitServerEnv()`; routes return **503 + clear JSON** when unset; no recording entry in nav until configured (or flag on) | Create LiveKit Cloud project; add env vars; register webhook URL in dashboard |
| **BLK-002** | **M5+ panel/dialog pixel layouts** | `docs/clips/descript/ui-layouts.md` sections not written from Descript screenshots | Build **ops, APIs, Prisma, tests, headless/state** only; **no improvised chrome** for version history, export dialog, scenes, layouts, media, music, Studio Sound, markers, comments, share, Rooms UI, multicam, project panel | Fill `ui-layouts.md` § by §; agent wires UI to match exactly |
| **BLK-003** | **M14 local MediaRecorder E2E on prod** | Needs stable long-run browser + fixture projects | Unit/integration tests + dev manual; prod §D1b **141+** when fixtures deployed | Confirm prod test projects + runbook |
| **BLK-004** | **Descript reference PNGs in repo** | Spec cites `/workspace/specs/descript-refs/` (not always on agent VM) | Use `script-editor.md` §A/D2 text + `SOURCES.txt` URLs; owner screenshots in `ui-layouts.md` when ready | Optional: vendor refs into repo or keep on server path |
| **BLK-005** | **Coolify deploy lag / health `commitSha`** | Container swap → transient **502/503** on status/notifications | Treat as deploy overlap unless errors persist >15 min post-deploy; check container uptime | None if self-heals after deploy |

## How to update

When you add a row, include **date**, **milestone**, and link to code (`lib/server/...`, route, flag name).

**Resolved:** move the row to a `## Resolved` section with date and commit SHA.
