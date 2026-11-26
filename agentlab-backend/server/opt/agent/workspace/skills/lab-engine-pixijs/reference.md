# pixijs: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 3. PixiJS (v8)

- **Repo:** https://github.com/pixijs/pixijs @ `1e70768` · **Install:** `/opt/engines/js/` (npm: `pixi.js`, `pixi-filters`)
- **Best at:** fast 2D WebGL: thousands of particles, sprite swarms, displacement and liquid distortions, glow, bloom, RGB-split, CRT and old-film filters, and photo shatter or explode effects.
- **Signature:** energetic, glowing, textured 2D. Sports-hype energy, neon, kinetic backgrounds, photos that ripple or burst.
- **Headless render:** `capture.mjs` (whole page is captured; this script has no `--canvas` flag). Create the app with `autoStart:false` and drive it from `seek`.
- **Minimal recipe:**
  ```js
  import * as PIXI from './lib/pixi.min.mjs';
  const app = new PIXI.Application(); await app.init({ canvas: document.getElementById('c'), width: 1080, height: 1920,
    backgroundAlpha: 0, antialias: true, autoStart: false, preference: 'webgl', preserveDrawingBuffer: true });
  app.ticker.stop(); const dots = [...Array(800)].map((_, i) => { const g = new PIXI.Graphics().circle(0, 0, 3).fill(0xffd34d); app.stage.addChild(g); return g; });
  window.__scene = { fps: 30, duration: 3, seek: async t => { dots.forEach((g, i) => { g.x = 540 + Math.cos(i + t) * (i % 400); g.y = 960 + Math.sin(i * 1.7 + t) * (i % 500); }); app.render(); } };
  window.__ready = true;
  ```
- **As a layer:** `backgroundAlpha:0` plus `capture.mjs --alpha` gives a WebM or MOV particle or FX layer, under the type and over the plate.
