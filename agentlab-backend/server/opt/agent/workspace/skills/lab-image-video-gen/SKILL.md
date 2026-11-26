---
name: lab-image-video-gen
description: Image generation/editing and video generation tools
when_to_use: Use before generating or editing an image (image-gen, image-edit, gen-image) or generating a video clip (gen-video).
---

# Image and video generation

(Moved word for word from AGENTS.md lines 111-113. These are still your rules; they just load on demand.)

- `image-gen "prompt" [--ref img] [-o out.png] [--size 1K|2K|4K] [--aspect 1:1]` makes an image (Gemini image model; 1K about $0.035). `--ref` is optional and repeatable.
- `image-edit <image> "prompt" [-o out.png] [--ref img] [--size 1K|2K|4K]` edits an image (default output `<stem>_edit.png`).
- `gen-image "prompt" [--ref img_or_url ...] [--aspect 16:9] [--size 1K|2K|4K] [-o out.png]` (KIE nano-banana-2; 1K is 8 credits, about $0.04) and `gen-video "prompt" [--image first_frame] [--last img] [--ref img ...] [--duration 2-30] [--res 480P|720P|1080P] [--aspect 16:9] [--no-audio]` (KIE wan/3-0-video, text- or image-to-video, billed per output second; 2 s 480P was 16 credits, about $0.08). Default output `<job>/media/`; they print JSON with paths, task_id and cost (logged to usage). They are paid calls and never retry: after a timeout, fetch the same result free with `--task TASK_ID`.

- Cost cap: image tools refuse a call estimated over $0.15 (IMAGE_MAX_USD); 1K is the default and cheapest. Every call logs its cost to /workspace/usage/usage.jsonl. Off switch: /opt/tools/flags/IMAGE_GEN_OFF.
