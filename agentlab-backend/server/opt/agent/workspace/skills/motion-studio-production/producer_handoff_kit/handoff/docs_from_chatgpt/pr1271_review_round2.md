# PR #1271, round 2 review (commit 30632ac), Nov 20 2026, 9:25 AM ET

Read-only review. Nothing was commented, pushed, merged or deployed, and no Docker image was built on sms.

## Status of round-1 items
Must-fix:
1. Image won't build (worker/ excluded): FIXED. There's a dedicated ignore file just for the render Dockerfile, and the shared .dockerignore, web Dockerfile and nixpacks config are unchanged. The new CI "docker-build" job passes.
2. make_bundle can't build from the job folder: FIXED. I tested it on a copy of the viewbotting job. Its zip has the same 169 files, in the same order, with byte-identical content, as the real render_bundle_v1.zip, except project.json. That file has the same data but is written without indentation (about 1.7 KB smaller). Both validators accept each other's zip.
3. Job login not loaded the producer's way: FIXED. submit, status and reuse use the same loader as lib_env.sh (secrets/job_url plus secrets/token, or the state/job_token fallback). Even with shell tracing turned on, no token was printed.
4. Test-mode switch name: FIXED. MOTION_BENCHMARK_ONLY=1 is honored, and so is the new name. In an offline mock run, test mode made no approve-master call, no editable publish and no completion call, either on success or on failure.
5. Disk check before building: FIXED (README step).
6. Health check and port: FIXED. /livez needs no secret and only answers "ok", while /health still needs the secret. The README says no port mapping and no domain.

Should-fix:
7. Temp files outside /work: FIXED. Temp files now go to /work/tmp, which is wiped on startup and after every job.
8. Cancelled jobs keep rendering: FIXED, but the fix added a new problem (item A below). Segments are now handed out a few at a time, running captures are stopped on cancel or timeout, and a 401/403/409 ends the job quietly.
9. Nice level stacking: FIXED (set once at startup).
10. Segment size on retries: FIXED. The default segment size follows the real film-length rule, and a retry reads the source size from state/receipts.json or reuse.json.
11. submit.json compatibility: FIXED. Same fields plus backend and render id, and submit_failed.json is written on failure. The time is now recorded in UTC instead of Eastern (cosmetic).
12. Modal fallback broken: FIXED. It now goes through a copy of the original Modal submit steps (Modal login, estimate, rates, call id). It's still off by default.
13. Kill-switch location: FIXED (the kit folder, the job folder and MODAL_DISABLED are all checked).
14. SKILL.md safety rules: FIXED (rules restored, and the "known gap until verified" note is back).
15. Missing tests: FIXED (one job at a time, cleanup after fail and cancel, no secrets in responses, liveness). The "skip a segment that's already registered" test exists in the pipeline tests.
16. Request size: FIXED (8 KB cap on the web endpoint).

## Remaining items for ChatGPT (none block the private Coolify app or the 60-second test)

Fix before the first real producer test:
A. **The page check can't find the browser on the producer box.** The new check_page only looks at CHROMIUM_BIN or /usr/bin/chromium. The producer box has /usr/bin/google-chrome, and the real kit's check_page tries CHROMIUM_BIN, then /usr/bin/google-chrome, then /usr/bin/chromium. As a result, "make_bundle --check-page" fails on the producer box unless CHROMIUM_BIN is set. With CHROMIUM_BIN pointed at google-chrome, it passed on the viewbotting bundle. Fix: use the same lookup order as the real kit.

Should fix before regular production use:
B. **The worker checks the job far too often during a render.** While segments render, it calls the job API about every 2 seconds, even when no segment has finished. Each call also renews the lease in the live site's database. That's about 200 calls for a 7-minute render and thousands for a long film. Fix: check only when a segment finishes, or about once a minute, whichever comes first. The 105-second heartbeat already keeps the lease alive.
C. **The page-check error hides the cause.** When the page check fails, make_bundle only prints "Render bundle validation failed". Print a short, secret-free reason, such as "browser not found", "puppeteer-core not found" or "seek check failed", so the producer can fix it.

Nice to have:
D. Note in the README that the render Dockerfile's own ignore file needs Docker BuildKit, which Coolify uses by default. On the old builder the build would fail safely, without affecting the web app.
E. Record submittedAt in Eastern time, as the old kit did (cosmetic).

## Still not done (needed before production, not code defects)
- Full new-app TypeScript check: no CI job runs it for this PR, and it wasn't run locally because it needs the full install. Run it before merge.
- Real producer end-to-end test and the 60-second render test on sms after the private Coolify app is set up.
