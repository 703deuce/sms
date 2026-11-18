# Editable delivery and review

Apply this section alongside the installed production routine, including revisions, clip jobs, and brand kits.

- Send progress when actual work changes. Use research, story, voice, design, scenes, review, fixing, rendering and delivering. Report scene number during construction and completed/total files during upload.
- Review full-size first, busiest and last frames for each scene. After a correction, capture the affected scene and boundary frames. Play a short excerpt for movement or sync. Watch the final approved master once before delivery.
- Run the producer command under `new-app/scripts/motion-studio/with-creative-lease.mjs` with the current job URL and token and a persistent volume in `MOTION_STUDIO_DURABLE_ROOT`. Use the supplied `MOTION_STUDIO_JOB_DIR` for the approved master, scene sources, kit export and ingest bundle records. On reassignment inspect this folder and the remote checkpoint before starting creative work.
- Install the updated bundle.mjs and frame-packs.mjs together on every producer and deterministic worker before writing packed projects. Install the accompanying simulator file on hosts using local previews. Numbered PNG, JPEG and WebP frames are packed without changing their contents.
- Finish writing the native kit export to a staging directory. Save the corresponding ingest bundle records as bundles.json. Rename the finished staging directory to approved on the same persistent volume. An existing approved/package.json and approved/bundles.json means resume publication from those files.
- Invoke `node new-app/scripts/motion-studio/publish-editable.mjs "$MOTION_STUDIO_JOB_DIR/approved" "$MOTION_STUDIO_JOB_DIR/approved/bundles.json"` with MOTION_STUDIO_JOB_URL and MOTION_STUDIO_JOB_TOKEN from the active assignment. The script recovers verified receipts from the job and submits the portable version after every asset is ready. For recovery from an earlier job on this project, pass its ID in MOTION_STUDIO_RECOVERY_SOURCE_JOB.
- Keep the approved files until publication is acknowledged. Reuse the reviewed master when completing the job. Use separate Main Voice, Ad-libs, and Main Visuals track roles in the editable timeline. Keep original item IDs and timings.

## Clean picture and timed overlays

Deliver the approved composite for playback and download. Supply the footage-only cut as a separate registered video named editor-base.mp4 for the editable canvas. Include each editable title, graphic and audio item in project.json on its track with startMs, endMs and sourceInMs. Retain editable scene code, keyframes, fonts and source artwork. A rendered overlay needs only its active interval. For editable transitions retain both source handles and the cut timing. Legacy deliveries with only a composite still open on that master.

Pipe production frames into the encoder. Omit framesDir for final renders. For selected stills during encoding, pass framesDir outside the scene and explicit zero-based reviewFrameIndices. For individual reviews, seek with stillBrowser. Pass sourceFiles to buildBundle for authored scenes; entries are relative file or directory names and include dynamically loaded dependencies. Genuine frame-sequence artwork belongs in that list. Render caches and screenshot folders do not. The allowlist is read only at build time; previously published projects remain readable.
