# threejs-theatre: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 4. Three.js + Theatre.js

- **Repos:** https://github.com/mrdoob/three.js @ `7922563` · https://github.com/theatre-js/theatre @ `6ea82b9` · **Install:** `/opt/engines/js/` (npm: `three`, `@theatre/core`, `@theatre/studio`, `postprocessing`; Theatre source in `theatre-src/`)
- **Best at:** keyframed 3D choreography: a camera that eases through 3D type, floating photo cards in space, product or object turntables, depth-of-field reveals, bloom. Theatre gives curve-edited keyframes across many objects, and `postprocessing` adds bloom, DOF, chromatic aberration and noise.
- **Signature:** glossy, cinematic 2.5D/3D motion design: extruded titles, photo planes in depth, light sweeps that are real light. It differs from Open 3D Skills (procedural environments and worlds); use this for *motion-design* 3D.
- **Headless render:** `capture.mjs` (whole page is captured; this script has no `--canvas` flag) (SwiftShader). Review with full-size browser stills; render only in the final render.
- **Keyframes without the Studio UI:** load `@theatre/studio` in the page and author keyframes in code with `studio.transaction(({set}) => …)`, scrubbing `sequence.position`. Export the state with `studio.createContentOfSaveFile('<project>')` to `theatre-state.json`. The render page loads only `@theatre/core` with `getProject('<project>', {state})`.
- **Minimal recipe:**
  ```js
  import * as THREE from 'three'; import {getProject, types} from '@theatre/core';
  const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(1080, 1920, false); r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.1, 100);
  const sheet = getProject('S07', { state }).sheet('main'); const camObj = sheet.object('cam', { z: types.number(12), y: types.number(0) });
  camObj.onValuesChange(v => { cam.position.set(0, v.y, v.z); cam.lookAt(0, 0, 0); });
  window.__scene = { fps: 30, duration: 4, seek: async t => { sheet.sequence.position = t; r.render(scene, cam); } }; window.__ready = true;
  ```
- **As a layer:** `alpha:true` plus clear alpha 0 plus `--alpha` gives 3D type or objects over footage. Add the light sweep as its own additive layer.
