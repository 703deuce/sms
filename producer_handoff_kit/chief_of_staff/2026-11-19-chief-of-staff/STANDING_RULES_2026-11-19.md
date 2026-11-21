# Chief of Staff Standing Rules (Consolidated through Nov 19, 2026)

Newer rules supersede older ones where they disagree.

## 1. Infrastructure, Git, and Safety
- **Never deploy or modify the SMS worker or Coolify `app3`.** Preserve their data and config.
- **No force-push, history rewrite, or reset.** Never bypass branch protection or required reviews.
- **Keep `PR #1270` (`docs/motion-studio-modal-render-20261119`) for John to merge.** Do not merge `grokbot/motion-studio-producer-kit-20261117`.
- **Additive DB migrations only.** No destructive DB operations without John.
- **Never expose secrets, keys, tokens, cookies, or signed URLs** in chat, logs, issues, PRs, or commits.
- **Build/CI rule (Nov 14):** The gate is BUILD + DEPLOY (`tsc` on changed files only; QA verifies behavior). Do not chase unrelated legacy `tsc` or old red CI noise.
- **Deploys >15 minutes** must be investigated, not waited out. Verify web deploys via `/api/health` (`commitSha`).

## 2. Spending, Usage, and Retries
- **No automatic paid retries or duplicate paid runs.** At most **1** attempt per paid AI or render run; escalate on failure.
- **No paid Modal or production render runs without John's explicit approval.**
- **Modal CPU is the approved render path (Nov 19):** John approved Modal spending and CPU rendering (`transovo-motion-render`, `~$0.19/rendered min` benchmarked), replacing local/box final rendering.
- **Never show `$` amounts in the product UI** — credits only (operator docs/reports may discuss `$`).

## 3. Motion Studio Product & Delivery Rules
- **Save after every stage** (research, script, clips, scenes, composed film, render chunks) so crashes/usage limits resume instead of restarting.
- **Render-first delivery:** Upload and approve `master_cpu.mp4` first so playback works immediately, then upload editable package/stems in the background and complete. Keep the rendered MP4 as project preview/master.
- **Playback security model:** Upload once -> verify once -> publish once -> play repeatedly using short-lived signed playback URLs. Never make B2 production uploads public.
- **Development/testing friction:** Already-issued scene links can open without extra friction during dev/testing, without weakening production B2 privacy.
- **Don't break existing Transovo modes:** Upload clipping, stream clipping, Compact Editor, Story, multi-source Story, Clean Take.
- **Don't flag copyright/licensing** of customer uploads, music, or market data; don't assign story angles in AI editorial prompts.
- **Browser discipline:** Keep Motion Studio project/editor tabs closed on the bot's box browser when idle.

## 4. Communication & Verification
- **Separate code written, tests passed, deployed, and verified in production.** Only claim what is verified.
- **Communicate only through real channels** (`SendToAgent`, GitHub issues/PRs). Never claim another bot was notified unless actually sent.
- **Escalate to John** for security risks, new spending, destructive DB ops, pricing changes, or strategic pivots.
