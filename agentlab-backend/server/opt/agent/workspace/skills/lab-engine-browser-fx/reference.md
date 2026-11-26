# Browser engines: recipes (from Motion Studio engine-library.md, adapted to /opt/engines/js)

## GSAP + SVG type
- Paused timeline; `seek: t => tl.seek(t, false)`. Per-word reveal: split words into spans (or SplitText), `tl.from(words, {yPercent:100, opacity:0, stagger:0.06, ease:'power3.out'})`.
- Scramble/decode for data-noir; DrawSVG for underlines, map routes, signatures; MorphSVG for icon changes.
- Readability: words hold >= 0.3 s each, min 1.2 s per line; >= 4.5% of frame height; inside a 5% inset.

## PixiJS v8
```js
import * as PIXI from './lib/pixi.min.mjs';
const app = new PIXI.Application(); await app.init({width:854, height:480, backgroundAlpha:0, preserveDrawingBuffer:true, autoStart:false});
document.body.appendChild(app.canvas);
// build particles from a seeded RNG; in seek(t): set each sprite from t (no Math.random at draw time), then app.render()
```
Filters: `pixi-filters` (Glow, AdvancedBloom, RGBSplit, CRT, OldFilm, Displacement). Seed every random value so a re-render matches.

## p5.js
`new p5(s => { s.setup = () => { s.createCanvas(854,480); s.noLoop(); }; s.draw = () => {}; window.__p5 = s; })`; in `seek(t)`: `randomSeed(1)`, draw the state at t, `redraw()`.

## Lottie
`const anim = lottie.loadAnimation({container, renderer:'svg', loop:false, autoplay:false, path:'assets/a.json'})`; on `DOMLoaded` set `__ready`; `seek: t => anim.goToAndStop(t*1000, false)`. Recolour to the film palette; never ship a stock look unchanged.

## Rive
`new rive.Rive({src:'assets/a.riv', canvas, autoplay:false})`; advance with `r.scrub(animationName, t)` per seek.

## Skia / CanvasKit
`CanvasKitInit({locateFile: f => './lib/' + f})`; draw in `seek(t)` to a `MakeWebGLCanvasSurface` or `MakeSWCanvasSurface`; flush each frame. Good for variable-font weight morphs (`FontMgr` with the font file in assets) and SkSL runtime-effect backgrounds.

## Layer rules
- Same fps and frame count as the segment it sits on; t=0 = the segment's start on the narration clock.
- Blend in RGB, check a transparent edge at 200% on a still before the final render.
- One art direction: put palette, fonts, easing in `scenes/theme.json` and read it in every scene.
