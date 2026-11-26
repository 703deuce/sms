// runtime configuration for this worker install (paths are local to the worker; nothing here is stored in projects)
import path from 'node:path'; import fs from 'node:fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const pick = (...c) => c.find(x => x && fs.existsSync(x)) || c[c.length - 1];
export const CFG = {
  root,
  python: process.env.MS_PYTHON || pick('/workspace/motion_prod_env/bin/python', '/usr/bin/python3'),
  cvPython: process.env.MS_CV_PYTHON || pick('/workspace/motion_prod_env/bin/python', '/workspace/motion_engines/mediapipe/venv/bin/python'),
  chrome: process.env.MS_CHROME || pick('/usr/bin/google-chrome', '/opt/google/chrome/chrome'),   // same binary the production capture adapter uses
  ffmpeg: 'ffmpeg',
  workDir: process.env.MS_WORK_DIR || path.join(root, 'out', 'work'),
};
