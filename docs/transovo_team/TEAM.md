# Transovo AI: 12-bot team (owner: John Jones)

Charters: /workspace/transovo_team/roles/*.md. The source plan is team_plan_original.txt.
Reporting: every bot reports to the Chief of Staff. The Chief of Staff reports to John. Security can escalate critical issues straight to John.

## Roster (agent ids for SendToAgent)
See ROSTER below. The Chief of Staff keeps it current.

## Environment
- Repo: https://github.com/703deuce/sms (web app in `new-app/`, clips worker in `worker/clips_worker/`). GitHub is the source of truth.
- GitHub access: env var `GITHUB_TOKEN` on the shared computer. Use the GitHub REST API or `gh` with GH_TOKEN=$GITHUB_TOKEN. Never print, echo, log or share the value. No local clones.
- Server: Hetzner + Coolify. SSH `cursor-agent@128.140.102.51`. Only Backend Engineer and DevOps run deploys; others need their approval.
- Web deploys automatically from master. Verify with `/api/health` commitSha. Deploying the workers uses `scripts/deploy-worker.sh` (Backend/DevOps).
- Shared files: /workspace (backlog: /workspace/transovo_feature_backlog.md).
- Runbooks: /workspace/transovo_team/runbooks/ (production logs: runbooks/logs.md).

## Hard rules (from John)
- Never deploy or modify the SMS worker or Coolify app3. Preserve their data and config.
- No force-push, history rewrite or reset. Branch, then PR, then CI, then a normal merge.
- Never show $ in the product UI. Use credits only.
- Additive DB migrations only. No destructive DB operations without John.
- Don't break working modes: upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take.
- Never expose secrets, keys, tokens, cookies or signed URLs.
- Don't assign story angles in AI editorial prompts.
- No automatic paid retries or duplicate paid runs. Keep usage frugal.
- Deploys should take minutes. Investigate long ones; don't wait them out.
- CI merge gates: see runbooks/ci-gates.md (build+deploy and a QA PASS; tsc is a syntax check only).
- Separate code written, tests passed, deployed, and verified in production. Only claim what's verified.
- The bot that writes code isn't the only one certifying it. QA, Video Quality and Security review independently.
- Work autonomously within these bounds. Escalate to John (via the Chief of Staff) only for security risks, real spending, destructive ops, pricing or strategy.
- Communicate only through real channels: SendToAgent and GitHub issues/PRs. Never claim another bot was notified unless you actually sent it.

## ROSTER
1. Chief of Staff: d7a6dc1a-8cc5-4dc0-a4d7-1ff750adf615
2. Researcher: 2e46c557-1340-400f-ae50-6e4446cc647a
3. Product Manager: c4c535e3-2937-46a3-80be-88f643a52d50
4. Backend Engineer (named "New"): 8508ade4-9425-4db7-8d32-a8265e0904e7
5. Frontend Engineer: 610ea706-4ddd-4847-a8be-e9d513f1c772
6. Landing Pages: 1a3a4a0a-1bd1-4d80-9197-eb3f41d301e4
7. QA Engineer: a5d7df12-c8f9-48e9-9808-8d4c1652f1fc
8. Video Quality: 3a810a68-4611-4a84-bc31-e293bfa6c829
9. Security: 6d0a56bd-47cc-480a-96d6-9fb799624a89
10. DevOps: cdb84bac-1eb8-42bf-a4b0-4aa08b140379
11. Customer Support: f5bb8b81-ab50-46bb-8b6c-86b74e68c341
12. Growth & Analytics: 1fa6f991-42c1-48ba-8818-b5e3151081ac
(Grok Bot 04661bbc-cc5f-4946-9d58-cc948d106ebb is a separate general assistant and not part of the 12.)

## Credentials (locations only, never values)
- Keys file: /home/box/.transovo_team_secrets.env (GITHUB_TOKEN, SUPABASE_NEW_SECRET_KEY). Held by Backend and the Chief of Staff, who grants other bots access per role.
- SSH key: /home/box/.ssh/grokbot_hetzner_ed25519, used as cursor-agent@128.140.102.51.
- App secrets live in the Coolify app env on the server.

## Build/CI rule (John, Nov 14 2026, 8:45 AM ET)
- The gate is: does it BUILD and DEPLOY. A quick TypeScript check is only there to catch syntax errors in the files you changed.
- Try the build. If the build or deploy fails, read the actual deploy/build logs, fix THAT error, and keep going.
- Do NOT chase or fix errors unrelated to the change you're making (legacy tsc errors, old red tests, unrelated CI jobs). Stop running in circles.
- QA still checks that the feature works; that's separate from CI noise.
