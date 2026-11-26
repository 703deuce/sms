# Do not rewrite these

## Core rules

- Never edit `/opt/agent/AGENTS.md`, `/workspace/AGENTS.md`, or a file whose name is `AGENTS.md`.
- Do not create a skill whose slug is `agents`, `agents-md`, or `core-rules`.

## Disabled video skills (leave disabled)

Do not create or restore `SKILL.md` in these folders, and do not update them:

- footage-gathering
- lab-motion-engines
- lab-site-video-download
- lab-stock-and-sfx
- lab-video-loop
- lab-video-minimal
- lab-video-producer
- lab-youtube-download
- motion-studio-production
- pixabay-stock
- sfx

Any other folder that has `SKILL.md.disabled*` and no `SKILL.md` is also off-limits (including `web-lookups`, which was folded into other skills). `save-skill` will refuse these.
