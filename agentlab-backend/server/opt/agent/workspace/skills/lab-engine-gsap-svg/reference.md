# gsap-svg: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 5. GSAP + SVG

- **Repo:** https://github.com/greensock/GSAP @ `5e6c35f` · **Install:** `/opt/engines/js/` (npm: `gsap`; every plugin is in the free package: SplitText, MorphSVG, DrawSVG, ScrambleText, MotionPath, CustomEase)
- **Best at:** typography and vector motion with designer-grade easing: per-character, word or line reveals, scramble or decode text, strokes drawing on, shape morphs, icons along paths, editorial lower thirds.
- **Signature:** crisp, typographic, magazine-like. This is the main tool for **typography variety**: the same headline can be split-staggered, masked line reveals, scrambled, drawn as outline then filled, or stacked and condensed.
- **Headless render:** `capture.mjs` (full-page screenshot; no canvas needed). Build one `gsap.timeline({paused:true})` and seek it.
- **Minimal recipe:**
  ```html
  <h1 id="h" style="font:900 150px/0.9 'Archivo Black';color:#fff">CMC TAKES OVER</h1>
  <script src="lib/gsap.min.js"></script><script src="lib/SplitText.min.js"></script><script>
  gsap.registerPlugin(SplitText); gsap.ticker.lagSmoothing(0);
  const tl = gsap.timeline({ paused: true }); const s = SplitText.create('#h', { type: 'chars,lines', mask: 'lines' });
  tl.from(s.chars, { yPercent: 110, stagger: 0.025, duration: 0.6, ease: 'expo.out' }).to('#h', { letterSpacing: '0.04em', duration: 2 }, 0);
  window.__scene = { fps: 30, duration: 3, seek: async t => tl.seek(t, false) }; window.__ready = true; </script>
  ```
- **As a layer:** transparent body plus `--alpha` gives a ProRes or WebM type layer, placed behind a SAM or rembg subject for text-behind-player shots.
