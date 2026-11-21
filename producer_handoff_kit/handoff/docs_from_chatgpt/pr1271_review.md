# Review of PR #1271 (Self-hosted Motion Studio renderer)

Repo 703deuce/sms, branch feat/self-hosted-motion-render-20261120, head commit 0e37ad0. Reviewed Nov 20, 2026 against the spec (self_hosted_render_spec.md) and against the real producer scripts the producer uses today. Nothing was commented, pushed, merged or deployed.

## Short verdict
The worker and the web endpoint are close to the spec and the design is sound. There's no public hostname, the shared secret is compared in constant time, there's one job at a time with 2 segment workers, the queue is saved and resumes after a restart, the modal_seg_v1_cpu_* names are kept, Modal is off by default and nothing prunes Docker. Two problems block it before deploy. First, the worker image won't build as written. Second, the new producer scripts don't fit how the real producer works, because they were written without the real scripts. The existing web app is safe while RENDER_WORKER_URL is unset: the only web change is one new endpoint, which just answers "not configured", and there are no database migrations.

Important context for ChatGPT: the real producer scripts were never pushed. They are attached separately (Rick will paste or attach them): make_bundle.py, submit.sh, status.sh, reuse.sh, reuse_assets.py, render_status.py, lib_env.sh, check_page.mjs, setup.sh and the README, from the producer's kit folder. The new render kit should start from those, as the spec said.

---

## MUST FIX before deploy

1. **The worker image won't build.** The repo's shared .dockerignore excludes the whole worker/ folder, so the Dockerfile.motion-render copy steps for worker/modal_motion/capture.mjs, pipeline.py and worker/motion_render_host/server.py will fail with "file not found". Don't loosen the shared .dockerignore, because that would make the live web app's build context bigger. Instead, give the render Dockerfile its own ignore file that applies only to it (Docker supports a per-Dockerfile ignore file named after the Dockerfile). That file should include only the three needed files.

2. **The new make_bundle.py can't build the bundle the way the producer does.** The real producer builds render_bundle_v1.zip from the job folder: the film/ folder (film.json or project.json, index.html, audio.wav) plus the editable package in editable/live/payload (live.packed.json or live.json). The real script writes package.json, bundles.json and live-project.json plus the blobs/ folder into the zip, and has a validate-only mode that submit.sh uses. The PR's version can only validate an existing zip or pack an already-staged deliver_modal/render_bundle/ folder, which the producer never creates. So the new SKILL.md step 2 would fail on a real job. Fix: carry over the real make_bundle.py unchanged, including its build-from-job-folder mode, validate-only mode and check-page mode, and only change its wording. (I checked the PR's validator against the real 1-minute viewbotting bundle and it accepts it, so the zip format itself matches. The gap is only in building it.)

3. **The new scripts don't load the job login the way the real producer stores it.** The PR's submit, status and reuse scripts expect MOTION_JOB_ID, MOTION_JOB_URL and MOTION_JOB_TOKEN to already be set in the environment. The real producer keeps them in each job folder, in secrets/job_url and secrets/token, with an older fallback of state/job_token plus the job_id file. The real lib_env.sh "load job env" step reads them from there without printing them. Fix: reuse lib_env.sh's job-login loading in submit, status and reuse, so all three work with just the job folder as the argument, exactly like today.

4. **The test-mode switch has a different name, and that could publish a test to a customer.** The real kit and the producer's habits use MOTION_BENCHMARK_ONLY=1 for QA-only test renders. The PR's submit only checks RENDER_BENCHMARK_ONLY. A producer who sets the usual MOTION_BENCHMARK_ONLY=1 would get a full live publish and completion. Fix: accept MOTION_BENCHMARK_ONLY as the main name. You can also accept the new name, but if either is set, treat it as test mode.

5. **Build the image only after checking disk on sms.** The server is around 89% used. The image (full Node 22 Bookworm, plus Chromium, FFmpeg and the npm packages) adds a few GB of image and build cache. Before the first build, check disk use, and if it's near 90%, remove only unused old images and build cache. Never touch volumes, running containers, app3 or the SMS worker. Build only while nothing is rendering. Add this to the worker README's deploy steps.

6. **Coolify health check and port.** The worker answers every request, including /health, with 401 unless the shared secret is sent. If Coolify's health check is turned on, the app will look unhealthy and may be restarted or fail its deploy. Either add a tiny liveness response that needs no secret and shows no job details, or say in the README to leave Coolify's health check off. Also state plainly in the README: no port mapping and no domain on this app, because the server listens on all interfaces inside the container.

## SHOULD FIX

7. **Leftover temp files skip the disk guard and aren't cleaned up.** The shared pipeline creates its temp folders (segment captures, the downloaded segments, the joined file, the master and the share copy) in the container's normal temp folder, not under /work. Only /work is checked for disk use and cleaned on startup. After a crash, those files stay in the container layer on the host disk. Fix: point the worker's temp folder at a folder inside /work, such as /work/tmp, and clear it on startup and after each job.

8. **A cancelled or timed-out job keeps rendering.** When the job API says a job is cancelled or finished partway through, or the time limit hits, the worker returns from inside the segment pool. That still waits for every remaining queued segment to render and upload. Fix: cancel the segments that haven't started, stop as soon as the running ones end, and then clean up. Per the spec, a 401 or 409 from the job API should end the job quietly, without posting a failure or a "complete failed".

9. **Nice level stacks up.** The worker raises its nice level again at the start of every job (10, then 19 from the second job on). Set it once at startup, or apply it only to the render child processes.

10. **Retries across backends can lose segment reuse.** The real submit picks segment size by film length: 150 frames for normal films, but larger for very long ones. For example, a 20-minute film uses about 390. The PR always defaults to 150 unless its own reuse.json exists. The real reuse.sh doesn't write that file; it writes state/receipts.json. A retry of a job Modal already rendered could then re-render everything. Fix: when retrying, read the segment size from the source job's submit.json or from its registered segment names, and keep the real reuse.sh behavior and file names (state/receipts.json, reuse_req.json, reuse_resp.json).

11. **Keep submit.json compatible.** The real status.sh reads mode, segments, segmentFrames, filmMinutes, submittedAt and benchmarkOnly from submit.json. The real "already submitted" check looks for an existing submission record. Write the same fields for self-hosted jobs, plus backend "self_hosted" and the render id (no cost estimate), so the old and new status scripts both work. Also keep writing submit_failed.json when a submit fails, as today.

12. **The Modal fallback branch is broken (it's off by default, but it should work if Rick turns it on).** It passes an empty bundle path, doesn't load the Modal login file, doesn't set the estimate and rate values the Modal app requires, and throws away the call id. Fix: when Modal is chosen, hand off to the real Modal submit.sh, the existing working path, instead of rebuilding it.

13. **The Modal kill switch is in the wrong place.** The real kill-switch file lives in the producer kit's own folder. The PR only checks the job folder and the MODAL_DISABLED setting. Check the kit folder too.

14. **SKILL.md section 8 dropped safety rules.** The rewrite removed several rules: never re-run a publish after a 401 or 409, never run stage-approved, publish-editable or publish-portable on a live job, and how to handle a FAILED background delivery. Put those back, reworded for the new path. It also now says "the server retains the approved MP4 on live completion". Nobody has confirmed that, so remove it, or keep the old "known gap" note until it's verified.

15. **Missing tests from the spec.** These are missing: only one job runs at a time; a segment that's already registered is skipped; the temp folder is deleted after fail and cancel, not just after pass; and no token or link appears in any response. Add them as offline tests.

16. **Web endpoint request size.** The new start-render endpoint reads the whole request body before checking its size. It's behind the job login, so the risk is low, but reject anything larger than a few KB before parsing it.

## NICE TO HAVE

17. **Auth model note.** The spec said "admin-authenticated", but the PR uses the job's own login and forwards that same job login to the worker. That's acceptable and arguably tighter, since it's scoped to one job. Just say so in the README so it isn't read as a mistake.

18. **Keep the job-API address consistent.** The web app builds the job address from MOTION_STUDIO_AGENT_PUBLIC_URL and allows any transovo.ai subdomain, but the worker only accepts the exact host transovo.ai. If that setting is ever a subdomain, every job is refused. Use one setting for both, or document that they must match.

19. **Moving to the dedicated server.** The allowed worker addresses include ordinary private network ranges, and the job login travels unencrypted inside the server network. That's fine on the same machine's Docker network. For a separate render box, recommend Tailscale (already allowed) rather than a plain private LAN, and note it in the README.

20. **Stable worker address on Coolify.** Note in the README that RENDER_WORKER_URL should use the worker app's stable Coolify network name, not a container name that changes on each deploy. Mention that the address check rejects names starting with a digit.

21. **Run as a non-root user.** The worker container runs as root with Chromium's sandbox off. Consider running it as an unprivileged user.

22. **Unused data.** The worker keeps a stage entry for every past job forever in queue.json. Trim entries older than a few days.

---

## What matches the spec (no change needed)
- There's no public hostname or new DNS. The web app forwards over the internal network using RENDER_WORKER_URL and a shared secret (at least 32 characters, compared in constant time). The worker address check accepts only internal names and private addresses over plain internal HTTP.
- One job runs at a time, with 2 segment workers by default, 3 tries per segment and a per-job time limit (180 minutes by default). Queued jobs keep their lease alive, and the queue is saved atomically to /work with private file permissions, then resumed after a restart.
- A job won't start above 90% disk. It stays queued, health shows "not accepting", and after 30 minutes it fails with "render host disk full". Nothing prunes Docker or touches other volumes.
- Segment names stay modal_seg_v1_cpu_<start>_<end>.mp4, and segments that are already registered are skipped. Join, QA, master_cpu.mp4 and share_cpu.mp4 uploads, approve master, editable publish (/portable) and live completion all run through the same pipeline code in the same order as the Modal app. Storage paths are unchanged because uploads still go through the job API.
- The Modal app is untouched except for an optional "use this already-unpacked bundle" input, and its default path is unchanged. Modal is off unless explicitly turned on.
- No database migrations, and no changes to existing web routes.

## CI and tests (as of 8:48 AM ET Nov 20)
- number-marketplace: passed.
- new-app-guards: failed. The marketing route check flags the page app/app/motion-studio/[projectId]/live, which is already on master and not touched by this PR, so the failure isn't caused by this PR.
- voice-agent-runtime: failed on type errors in unrelated voice and missed-call files. It fails the same way on master.
- clips-worker-pytest: still running on the PR. It fails on master too.
- No CI job type-checks the new web endpoint. A full Next.js typecheck wasn't run locally, because it needs the full dependency install. Please run the new-app typecheck before merge.
- Ran locally in a separate checkout (offline): worker tests 7 passed, Modal pipeline tests 5 passed, submit tests 4 passed. I also ran the PR's bundle validator on the real viewbotting bundle (it passed) and the PR's submit in dry-run mode (12 segments of 150 frames). It refuses to run when the job login isn't already in the environment, which is item 3.
