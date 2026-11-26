# revideo: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 2. Revideo

- **Repo:** https://github.com/redotvideo/revideo @ `b5de67a` · **Install:** `/opt/engines/js/` (npm: `@revideo/core`, `2d`, `renderer`, `vite-plugin`, `ffmpeg`, `vite@5`)
- **Best at:** Motion Canvas-style scenes rendered headlessly from Node, plus video and audio elements in the scene graph. Good for templated-feeling *structures* that you dress differently each time: data-driven lists, rankings, stat runs, footage with animated masks.
- **Signature:** the same crisp procedural vector feel as Motion Canvas. Strong for masks, morphing shapes over footage, and code-driven counters.
- **Headless render:** `renderVideo()` from `@revideo/renderer` drives Chrome through puppeteer. Point it at system Chrome.
- **Minimal recipe:**
  ```ts
  // render.mjs (run with: node render.mjs, from a scene folder holding src/project.ts)
  import {renderVideo} from '@revideo/renderer';
  await renderVideo({ projectFile: './src/project.ts',
    settings: { outFile: 'S06.mp4', outDir: './out', logProgress: true, workers: 2,
                puppeteer: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] } } });
  // src/project.ts: import {makeProject} from '@revideo/core'; export default makeProject({scenes:[s], settings:{shared:{size:{x:1080,y:1920}}}});
  ```
  Check option names against `src/packages/renderer` at the pin on first use, and trim with `-frames:v` to the exact frame count.
- **As a layer:** the renderer writes opaque MP4. For a transparent layer, use the Motion Canvas Image-sequence route above, or build that layer in a `capture.mjs` engine. Never key out a flat colour.
