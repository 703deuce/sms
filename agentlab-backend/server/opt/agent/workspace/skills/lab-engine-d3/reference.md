# d3: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 8. D3.js (SVG, animated with GSAP)

- **Repo:** https://github.com/d3/d3 @ `db118c9` · **Install:** `/opt/engines/js/` (npm: `d3`, `gsap`)
- **Best at:** real data as graphics: bar races, line charts drawing on, scatter swarms, force networks of people, map projections (d3-geo), timelines, box-score breakdowns, stat comparison bars.
- **Signature:** editorial data journalism (NYT, The Pudding). Precise, information-dense, credible.
- **Headless render:** `capture.mjs`. Don't use d3 transitions (they run on a timer). Compute each frame from `t`: use d3 scales and interpolators with a GSAP paused timeline, or set attributes directly from `t`.
- **Minimal recipe:**
  ```js
  const data = [{k:'SF',v:46},{k:'DAL',v:40}]; const x = d3.scaleLinear([0,50],[0,800]);
  const bars = d3.select('svg').selectAll('rect').data(data).join('rect').attr('y',(d,i)=>200+i*140).attr('height',100).attr('fill',(d,i)=>i?'#041e42':'#aa0000');
  const tl = gsap.timeline({paused:true}); data.forEach((d,i)=> tl.fromTo(bars.nodes()[i], {attr:{width:0}}, {attr:{width:x(d.v)}, duration:1.2, ease:'power3.out'}, i*0.15));
  window.__scene = { fps:30, duration:3, seek: async t => tl.seek(t,false) }; window.__ready = true;
  ```
- **As a layer:** a transparent SVG chart plus `--alpha` gives a stat overlay on a footage plate or a 3D background.
