# skia: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 12. Skia / CanvasKit

- **Repo:** https://github.com/google/skia @ `549e9af` (pin noted; the source tree is huge and was not cloned) · **Install:** `/opt/engines/js/` (npm: `canvaskit-wasm`)
- **Mandatory placement:** build CanvasKit inside the browser scene (load `canvaskit.wasm` in the page, draw on a canvas driven by `seek(t)`) and review it by browser still like every other browser engine. Only an existing Node Skia script stays in Node; review it by rendering a single frame index to PNG (e.g. `MS_FRAME=<n> node frames.mjs > S_<n>.png`), never by piping frames to ffmpeg before approval.
- **Best at:** high-quality 2D drawing: shaped paragraph text with any font file, variable-font weight animation, SkSL runtime shaders (procedural gradients, noise, liquid backgrounds), path effects (dashes, trims, discrete jitter), blur and shadows.
- **Signature:** smooth, print-quality type and procedural shader backgrounds. A cheap way to get luxury, Swiss or minimal DNA without a browser.
- **Final render only (Node script case):** a Node script draws each frame on a CPU raster surface and pipes PNGs to ffmpeg, after approval.
- **Minimal recipe:**
  ```js
  // node frames.mjs | ffmpeg -f image2pipe -framerate 30 -i - -frames:v 90 -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov
  import CanvasKitInit from 'canvaskit-wasm'; import fs from 'node:fs';
  const CK = await CanvasKitInit(); const surf = CK.MakeSurface(1080, 1920); const c = surf.getCanvas();
  const font = CK.Typeface.MakeFreeTypeFaceFromData(fs.readFileSync('assets/fonts/Inter-Black.ttf'));
  const paint = new CK.Paint(); paint.setColor(CK.WHITE); paint.setAntiAlias(true);
  for (let i = 0; i < 90; i++) { const t = i / 30; c.clear(CK.TRANSPARENT);
    c.drawText('FINAL', 120, 960, paint, new CK.Font(font, 160 + t * 20));
    process.stdout.write(surf.makeImageSnapshot().encodeToBytes()); }
  ```
- **As a layer:** natively transparent PNG frames, so pipe them to ProRes 4444 or VP9-alpha.
