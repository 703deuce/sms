<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Local dev stack: Docker + Supabase CLI (`supabase start`), Prisma `db:push`, then `npm run dev` on port 3000. Demo login after seed: `alex@harborhome.co` / `demo1234`.

**Auto-orchestration only applies when the agent boots from a saved environment** that uses the repo’s `.cursor/environment.json`. Runs with environment `source: Override` (no `environmentJsonPath`) skip `install` / `start` / dev terminals — `/tmp/cursor/` never appears and Docker/Supabase are not installed until you Save the environment in Portal.

- **Install** (VM refresh): `bash scripts/cloud-agent-install.sh`
- **Start** (container boot): `bash scripts/cloud-agent-start.sh` — starts dockerd, Supabase, `db:push`, grants, guarded seed (~90s cold)
- **Dev server**: `npm run dev` (also declared as the `dev` terminal in `.cursor/environment.json`)

Nested Docker needs `fuse-overlayfs` storage driver; install script sets this. If container↔container networking fails, `install` sets `net.bridge.bridge-nf-call-iptables=0`.

After changing `node_modules`, restart `npm run dev` — hot reload may not pick up new native deps.

