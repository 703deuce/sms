# rive: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 10. Rive

- **Repo:** https://github.com/rive-app/rive-wasm @ `c654d76` (runtime core: https://github.com/rive-app/rive-runtime @ `b36f5c8`) · **Install:** `/opt/engines/js/` (npm: `@rive-app/canvas`, `@rive-app/canvas-advanced`)
- **Best at:** playing `.riv` files: state-machine character and UI animations, animated icons, mascots, buttons and counters with designer polish. Text runs and inputs can be changed at runtime.
- **Signature:** smooth, app-like, playful vector character motion.
- **Limit:** `.riv` files are authored in the Rive editor, and the bot can't author them in code. Use files from the Rive community library (rive.app/community), or files the customer provides. Change text runs, colours and inputs per film so it never looks stock.
- **Headless render:** `capture.mjs` (whole page is captured; this script has no `--canvas` flag) with the low-level `@rive-app/canvas-advanced` runtime. Rive is stateful, so `seek` advances the artboard by the delta since the last frame (the adapter always seeks forward).
- **Minimal recipe:**
  ```js
  import RiveCanvas from './lib/canvas_advanced.mjs';
  const rive = await RiveCanvas({ locateFile: f => './lib/' + f }); const renderer = rive.makeRenderer(c);
  const file = await rive.load(new Uint8Array(await (await fetch('assets/badge.riv')).arrayBuffer()));
  const ab = file.defaultArtboard(); const sm = new rive.StateMachineInstance(ab.stateMachineByIndex(0), ab); let last = 0;
  window.__scene = { fps: 30, duration: 3, seek: async t => { const dt = t - last; last = t; sm.advance(dt); ab.advance(dt);
    renderer.clear(); renderer.save(); renderer.align(rive.Fit.contain, rive.Alignment.center, { minX: 0, minY: 0, maxX: c.width, maxY: c.height }, ab.bounds); ab.draw(renderer); renderer.restore(); renderer.flush(); } };
  window.__ready = true;
  ```
- **As a layer:** transparent canvas plus `--alpha` gives an animated badge, icon or mascot layer.
