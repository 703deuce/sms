# Fix note for ChatGPT: post-render QA and render failures (PR #1271, self-hosted render worker)

Plain-language spec, no code. Applies to the self-hosted render worker (worker/motion_render_host/server.py) and the shared render pipeline it reuses (worker/modal_motion/pipeline.py, the qa_video step and the join-and-QA step). Keep the Modal path consistent with the same rules.

## Why this is needed

On Nov 20 the Streamer Awards film (job msaj_9b841a11-...) rendered perfectly on our server, then post-render QA rejected it for "Extended black frames detected". The film's dark look is intentional: near-black backgrounds with a line of text building in. The editor had already reviewed and approved every frame before render. The worker then deleted the MP4, marked the job permanently failed, and told the customer "We hit a snag". Nobody could see the video, and the job could not be re-delivered because it was closed.

## 1. Post-render QA checks only technical render failures

The editor/producer reviews and approves the film before it is sent to render. Post-render QA must not second-guess the design.

- Remove the black-frame check from post-render QA entirely. Do not turn it into a warning; drop it.
- Remove any other check that judges the look or design (dark scenes, static/held frames, low motion, "too bright", "too empty", and so on). None should exist, now or later.
- Never warn the customer or the team about design from the render step.
- What post-render QA keeps checking (real render/technical failures only):
  - the render crashed or a segment is missing;
  - frame count does not match the plan;
  - video duration does not match the plan, or audio length does not match the video;
  - audio track missing, or silent;
  - the file is corrupt or cannot be decoded all the way through;
  - wrong resolution or frame rate compared with the project.
- Loudness: the encode already normalizes loudness, so treat a loudness miss as something the worker fixes itself (re-run the audio normalization), not a reason to fail the film.

## 2. Never delete the video when something goes wrong

- When any check fails, keep the master MP4 and the share copy. Upload them to the job's storage (or keep them in the job's work folder) before reporting the failure, so the owner and producer can open them.
- Only clean up temporary files after the job is truly finished (delivered, or given up on after retries and the owner has been told).
- Rendered segments must also be kept so a retry never re-captures frames that already rendered fine.

## 3. A failure must never silently stop the job (from Rick)

Required behavior for a genuine render/technical failure:

1. Keep the files (section 2).
2. Retry the render automatically, reusing the segments that already rendered fine. At most 1–2 automatic attempts.
3. Do not mark the job permanently "failed" on the first problem. The current worker calls the "complete as failed" step right away, which closes the job forever and blocks any retry or re-delivery on that job. A failed check should put the job in a clear "needs fix / retrying" state instead, and the job stays open.
4. Tell the producer right away through its job API / webhook: which check failed, the timestamps involved, and where a frame grab and the kept MP4 are, so it can fix and resubmit if the problem is in the bundle. A producer resubmit on the same job must be accepted and must reuse the existing segments.
5. The customer's project page shows a clear, honest status ("Finishing touches, retrying the final render" or similar), never stuck at 0% or "rendering", and never a vague "We hit a snag".
6. If the automatic attempts still fail, alert the owner (Rick) with the job, the failed check and the kept files, and show the customer a clear status that the team is on it. Only the owner decides to close the job as failed.

## 4. Done when

- A dark, intentionally near-black film with one line of text renders, passes QA and is delivered with no warning.
- A forced technical failure (for example a missing segment) keeps the MP4/segments, retries on its own up to 2 times reusing segments, keeps the job open with a clear customer status, notifies the producer with the check, timestamps and frame grab, and alerts the owner only after the retries fail.
- No code path deletes a rendered master or share copy before the job is finished.
