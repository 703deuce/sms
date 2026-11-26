# open-3d: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 4. Open 3D Skills (Moh4696/open-3d-skills @ `53beb89`), three.js

- **Where:** `/opt/engines/repos/open-3d-skills/skills/`.
- **Manuals** (each `SKILL.md`):
  - `threejs-scene` (+ `references/{geometry,lighting,shaders,performance}.md`, starter `assets/starter/{index.html,main.js,env.js,kit.js,scene.js}`)
  - `exploded-view` (`assets/explode.js`, demo `assets/demo/{index.html,motor.js}`)
  - `frame-capture` (`scripts/{serve.py,record.py,compare.py}`)
  - `site-check`, `alpha-cutout`, `motion-assets`, `scroll-film`, `cursor-rig`
- **Setup:**
  ```bash
  # deps already installed system-wide (playwright, pillow, numpy, opencv)
  ```
- **Build/record:** copy the starter, keep `env.js/kit.js/main.js`, and write a new `scene.js` for this subject from real dimensions in metres. Drive the camera flight with `window.__recordFrame = t => {…}` behind `?record=1`, and expose `window.__ready`.
  ```bash
  O=/opt/engines/repos/open-3d-skills/skills/frame-capture/scripts
  python3 $O/serve.py $J/scenes/S04/site --port 8xxx &          # pick a free port; NEVER python -m http.server (breaks video seeks)
  # review: open the page in the browser, call window.__recordFrame(t) for the time in question and take a screenshot; no timing-pass recording
  python3 $O/record.py http://127.0.0.1:8xxx/?record=1 $J/scenes/S04/out/S04.tmp.mp4 --seconds 12 --fps 30 --size 1920x1080 --ready "window.__ready === true"
  ```
- **Strengths:** convincing procedural 3D (light and proportion), exploded/x-ray product views, camera flights, frame-exact recording.
- **Limits:**
  - Not Blender.
  - `motion-assets`, `alpha-cutout`, `scroll-film` and `cursor-rig` expect paid image/video generation, so price and log those first.
  - Recording is CPU-heavy, so take the render lock.
