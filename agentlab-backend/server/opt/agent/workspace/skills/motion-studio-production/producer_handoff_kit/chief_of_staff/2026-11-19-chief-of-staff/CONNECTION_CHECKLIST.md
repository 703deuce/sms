# Connection & Transfer Checklist (New Chief of Staff Bot)

This repo holds **zero secrets**. When booting on a new account or machine, ask John for the items you are missing (use `secret-request` for tokens/keys, or have him approve SSH/login access), store them only in your secure local env/keychain, and never echo or commit them.

---

## 1. GitHub (`703deuce/sms`)

- **What you need:** GitHub connector (`cursor-github`) OR `GITHUB_TOKEN` (fine-grained PAT on `703deuce/sms`, pull/push/issues/PRs).
- **Clone & verify:**
  ```bash
  set +x
  git clone https://github.com/703deuce/sms.git /workspace/sms
  cd /workspace/sms
  GH_TOKEN="$GITHUB_TOKEN" gh auth status
  ```
- **Rule:** Never `echo` tokens, never force-push or rewrite history, never merge `PR #1270` or `grokbot/motion-studio-producer-kit-20261117` without John's instruction.

---

## 2. Hetzner Server & Coolify (`128.140.102.51`)

- **Host & user:** `cursor-agent@128.140.102.51`
- **What you need:** A fresh Ed25519 SSH keypair generated on your new box, with the **public key** given to John to add to `~cursor-agent/.ssh/authorized_keys` on `128.140.102.51` (or an existing key John transfers securely).
- **Verify:**
  ```bash
  ssh -i ~/.ssh/id_ed25519 -o ConnectTimeout=15 cursor-agent@128.140.102.51 'df -h / && docker ps --format "table {{.Names}}\t{{.Status}}"'
  ```
- **Key containers on Hetzner:**
  - Web app (`new-app`): Coolify application ID `1`, container prefix `ds8s3hjin60qs6g7s0iqkixs-*` (rebuilt automatically on push to `master`; takes ~6 minutes).
  - Clips worker (`clips-worker`): holds `DATABASE_URL`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_APP_NAME`, `MODAL_MONTHLY_BUDGET_USD`, and `MOTION_STUDIO_COORDINATOR_ADMIN_KEY` in its container env (`docker exec clips-worker env`). **Do not modify or redeploy the SMS worker or Coolify app3.**
  - Coolify DB (`coolify-db`): inspect deployment queue/status if a deploy stalls.

---

## 3. Modal (`transovo-motion-render`)

- **What you need:** `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (exist in prod `clips-worker` env; ask John to provide via `secret-request` or authorize pulling from server if needed), plus Python `modal` CLI installed in a virtualenv on your box.
- **Required env vars for Modal deploy & submit:**
  - `MODAL_TOKEN_ID`
  - `MODAL_TOKEN_SECRET`
  - `MODAL_APP_NAME=transovo-motion-render`
  - `MODAL_MONTHLY_BUDGET_USD` (default `"30"`)
  - `MOTION_CPU_USD_PER_SECOND=0.00007016`
  - `MOTION_GPU_USD_PER_SECOND=0.00023416`
- **Setup & verify on a fresh Linux box:**
  ```bash
  python3 -m venv /tmp/modal-venv
  /tmp/modal-venv/bin/pip install --upgrade modal
  set +x
  export MODAL_TOKEN_ID=... MODAL_TOKEN_SECRET=...
  /tmp/modal-venv/bin/modal app list
  ```
- **Deploy `worker/modal_motion/` after any Modal code change:**
  ```bash
  cd /workspace/sms/worker/modal_motion
  /tmp/modal-venv/bin/modal deploy -m app
  ```

---

## 4. Motion Studio Coordinator & APIs

- **What you need:**
  - `MOTION_STUDIO_COORDINATOR_ADMIN_KEY` (stored in prod web/worker env on Hetzner) — used to manually trigger `POST https://transovo.ai/api/motion-studio/agent/coordinator`.
  - **Transovo web login** (`https://transovo.ai`) — for verifying live project playback/editor pages in the browser (use Vault / `RequestUserForm` per platform rules; keep Motion Studio pages closed when idle so stale tabs don't interfere).
- **Supabase (`SUPABASE_NEW_SECRET_KEY` / `DATABASE_URL`):**
  - `DATABASE_URL` lives on the server (`clips-worker` / Coolify web env). Use read-only `psycopg2` queries via `docker exec clips-worker python3 -c ...` when inspecting `MotionStudioAgentJob`, `MotionStudioProject`, or `MotionStudioWorkerPlan`.
  - Any schema change MUST be additive only; no destructive DB ops without John.

---

## 5. Teammate Bots & Routines (New Account Setup)

- Verify which teammate bots exist in `<teammates>` on the new account (especially **Motion Studio Producer**). Update `team/AGENTS.md` with the new account's active agent IDs if they changed.
- Check `<automation_status>` and ask John if he wants the daily owner summary routine recreated on the new bot.
