// runtime-lock.mjs: exact runtime versions + seeds a render depends on (stored in the package as an asset).
import { run } from './util.mjs'; import { CFG } from './config.mjs'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function runtimeLock() {
  const v = async (c, a, re) => { try { const r = await run(c, a); const m = re.exec(r.out + r.err); return m ? m[1] : (r.out + r.err).split('\n')[0].slice(0, 60); } catch { return null; } };
  const py = await v(CFG.python, ['-c', 'import sys,skia,PIL,numpy,cv2,fontTools;print(sys.version.split()[0],skia.__version__,PIL.__version__,numpy.__version__,cv2.__version__,fontTools.version)'], /(.*)/);
  const [pyv, skia, pil, np, cv2, ft] = (py || '').split(' ');
  return { schema: 'transovo.runtime-lock/1', chrome: await v(CFG.chrome, ['--version'], /([\d.]+)/), chromeFlags: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--font-render-hinting=none', 'deviceScaleFactor=1'],
    node: process.version, puppeteer: require('puppeteer-core/package.json').version, ffmpeg: await v('ffmpeg', ['-version'], /ffmpeg version (\S+)/), x264: 'libx264 (ffmpeg build)',
    python: pyv, pythonPackages: { 'skia-python': skia, Pillow: pil, numpy: np, 'opencv-python': cv2, fonttools: ft }, canvaskit: require('canvaskit-wasm/package.json').version,
    seeds: { keithPageFiller: 11, ffmpegNoise: 'ffmpeg default (123457)', grain: 20261117 } };
}
