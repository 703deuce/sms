# hyperframes: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 3. HyperFrames (heygen-com/hyperframes @ `e426ce4`), HTML → video

- **Where:** `/opt/engines/repos/hyperframes`.
- **Manuals:**
  - core: `/opt/engines/repos/hyperframes/skills/hyperframes/SKILL.md` (the render contract, 12 rules; the work loop; a "What to read" table pointing at `references/types/{launch,explainer,music,data,vertical,3d,character}.md`, `references/{film,motion,captions,overlays,format,runtimes,story,spec,review,sound,look}.md`)
  - CLI: `/opt/engines/repos/hyperframes/skills/hyperframes-cli/SKILL.md`
  - registry: `/opt/engines/repos/hyperframes/skills/hyperframes-registry/SKILL.md`
  - media: `/opt/engines/repos/hyperframes/skills/media-use/SKILL.md` (local tools only; no HeyGen)
  - craft skills in `/opt/engines/repos/hyperframes/.agents/skills/` (`motion-doctrine`, `seam-craft`, `cut-the-curve`, `captions-overlay`)
  - rendering docs: `/opt/engines/repos/hyperframes/docs/guides/rendering.mdx`
- **Build/render:**
  ```bash
  /opt/engines/js/node_modules/.bin/hyperframes init $J/scenes/S05 --skip-skills
  /opt/engines/js/node_modules/.bin/hyperframes add <block>                 # search the registry before hand-writing an effect
  /opt/engines/js/node_modules/.bin/hyperframes lint && /opt/engines/js/node_modules/.bin/hyperframes check --json     # fix every error
  /opt/engines/js/node_modules/.bin/hyperframes snapshot --at 1,3,5          # read the PNGs under .hyperframes/artifacts/snapshots/
  /opt/engines/js/node_modules/.bin/hyperframes render --quality delivery -o out/S05.mp4
  /opt/engines/js/node_modules/.bin/hyperframes render --format webm -o out/S05_overlay.webm   # transparent overlay; --format mov for ProRes
  ```
  Contract highlights: every timed element is `class="clip"` with `data-start`/`data-duration`; there is one paused GSAP timeline registered on `window.__timelines`; no `Date.now()`, unseeded random, network fetches or timers; assets via `assets/…` paths.
- **Strengths:** editorial motion graphics; infographics and charts; strong typographic design systems; deterministic; true alpha output; ~450 registry blocks as editable source.
