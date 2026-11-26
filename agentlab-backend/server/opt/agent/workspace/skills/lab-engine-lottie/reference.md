# lottie: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 11. Lottie / dotLottie

- **Repos:** https://github.com/airbnb/lottie-web @ `bede03d` · https://github.com/LottieFiles/dotlottie-web @ `9aa07ff` · **Install:** `/opt/engines/js/` (npm: `lottie-web`, `@lottiefiles/dotlottie-web`; dotLottie source in `dotlottie-src/`)
- **Best at:** After Effects-made vector animations: animated icons, shape bursts, arrows, underlines, scribbles, loaders, emoji-style accents. There is a huge public library on LottieFiles, and the bot can also write simple Lottie JSON itself.
- **Signature:** motion-designer accents (shape-layer pops, line flourishes). Best as small layers, not whole scenes.
- **Headless render:** `capture.mjs`. With lottie-web (SVG renderer), seek with `anim.goToAndStop(t * anim.frameRate, true)`. With dotLottie (ThorVG canvas), seek with `dl.setFrame(t * fps)`.
- **Minimal recipe:**
  ```js
  const anim = lottie.loadAnimation({ container: document.getElementById('l'), renderer: 'svg', loop: false, autoplay: false, path: 'assets/burst.json' });
  await new Promise(r => anim.addEventListener('DOMLoaded', r));
  window.__scene = { fps: 30, duration: anim.getDuration(), seek: async t => anim.goToAndStop(Math.min(t * anim.frameRate, anim.totalFrames - 1), true) };
  window.__ready = true;
  ```
  Recolour the JSON to the film's palette before use.
- **As a layer:** natively transparent. `--alpha` gives a WebM or MOV accent layer, timed to a hit word.
