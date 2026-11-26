# p5: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 6. p5.js (2.x)

- **Repo:** https://github.com/processing/p5.js @ `c60c735` · **Install:** `/opt/engines/js/` (npm: `p5`)
- **Best at:** generative and organic visuals: noise flow fields, halftone and dither treatments of photos, hand-drawn wobble lines, ink and paper textures, pixel sorting, glitch, generative backgrounds that react to audio amplitude.
- **Signature:** artsy, handmade, analogue-digital. Good for gritty editorial collage, zine, retro and glitch DNA.
- **Headless render:** `capture.mjs` (whole page is captured; this script has no `--canvas` flag). Use instance mode with `noLoop()` and redraw on seek.
- **Minimal recipe:**
  ```js
  let T = 0; const inst = new p5(s => { s.setup = () => { s.createCanvas(1080, 1920); s.pixelDensity(1); s.noLoop(); };
    s.draw = () => { s.clear(); s.stroke(255, 60); for (let i = 0; i < 400; i++) { const a = s.noise(i * 0.01, T * 0.3) * s.TWO_PI * 2; s.line(i * 2.7, 960, i * 2.7 + Math.cos(a) * 80, 960 + Math.sin(a) * 80); } }; });
  window.__scene = { fps: 30, duration: 3, seek: async t => { T = t; inst.redraw(); } }; window.__ready = true;
  ```
  Seed randomness (`s.randomSeed`, `s.noiseSeed`) so frames repeat exactly. Load photos with `await s.loadImage()` before `__ready`.
- **As a layer:** `clear()` instead of `background()` plus `--alpha` gives a texture, scribble or grain layer.
