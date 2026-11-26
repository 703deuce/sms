# motion-canvas: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 1. Motion Canvas

- **Repo:** https://github.com/motion-canvas/motion-canvas @ `7b91435` · **Install:** `/opt/engines/js/` (npm: `@motion-canvas/core`, `2d`, `ui`, `vite-plugin`, `ffmpeg`, `vite@5`)
- **Best at:** precise, programmatic vector animation driven by generators and signals. Code blocks that morph line by line, diagrams, flowcharts, maths-style explainers, tidy shape choreography.
- **Signature:** clean, flat, exact vector motion with springy procedural tweens. It feels "engineered", like a YouTube explainer. Great for "how it works" beats, a strong change from Cinematic's paper world.
- **Headless render:** Motion Canvas renders from its editor, not a CLI. Run `npx vite --port 9000`, open the editor with puppeteer-core (system Chrome), set the exporter (FFmpeg video, or Image sequence for alpha), and click **Render**. Output lands in `output/`. Revideo (next entry) uses the same scene API with a real headless `renderVideo()`. **For unattended renders, write the scene in Motion Canvas syntax and render it with Revideo.** Use the Motion Canvas editor route only if a Motion Canvas-only feature is needed.
- **Minimal recipe:**
  ```ts
  // src/scenes/s.tsx
  import {makeScene2D, Txt, Rect} from '@motion-canvas/2d'; import {createRef, all, waitFor} from '@motion-canvas/core';
  export default makeScene2D(function* (view) { const t = createRef<Txt>();
    view.add(<Txt ref={t} text="4TH QUARTER" fontFamily="Anton" fontSize={140} fill="#fff" opacity={0}/>);
    yield* all(t().opacity(1, 0.4), t().scale(1.15, 2)); yield* waitFor(1); });
  // src/project.ts: makeProject({scenes: [s]})   vite.config.ts: plugins: [motionCanvas(), ffmpeg()]
  ```
- **As a layer:** set the project background to transparent and export an **Image sequence** (PNG with alpha), then `ffmpeg -framerate 30 -i %06d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le layer.mov`.
