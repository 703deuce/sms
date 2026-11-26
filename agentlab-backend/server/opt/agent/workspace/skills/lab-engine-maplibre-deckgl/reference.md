# maplibre-deckgl: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 9. MapLibre GL JS + deck.gl

- **Repos:** https://github.com/maplibre/maplibre-gl-js @ `dd1b28e` · https://github.com/visgl/deck.gl @ `dbfac3d` · **Install:** `/opt/engines/js/` (npm: `maplibre-gl`, `deck.gl`, `@deck.gl/mapbox`; deck.gl source in `deckgl-src/`)
- **Best at:** real vector maps with 3D camera flights (pitch, bearing), extruded 3D buildings, terrain, animated arcs between cities, trips layers (moving paths), heatmaps, hex bins, route lines that draw on.
- **Signature:** broadcast-news or Google-Earth-style map flights with real geography. A different look from Cinematic's printed-paper maps.
- **Headless render:** `capture.mjs` (whole page is captured; this script has no `--canvas` flag). On each `seek`, compute the camera from `t`, call `map.jumpTo({...})`, then `await new Promise(r => map.once('idle', r))` so the tiles are loaded before the frame is grabbed. Tiles need network at render time. A free style with no key is `https://tiles.openfreemap.org/styles/liberty` (or `https://demotiles.maplibre.org/style.json` for a plain base). Restyle the layers to the film's palette; never ship the stock style.
- **Minimal recipe:**
  ```js
  const map = new maplibregl.Map({ container: 'm', style: 'https://tiles.openfreemap.org/styles/liberty', interactive: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true }, center: [-97.09, 32.75], zoom: 12, pitch: 60 });
  const overlay = new deck.MapboxOverlay({ layers: [] }); map.addControl(overlay); await new Promise(r => map.on('load', r));
  window.__scene = { fps: 30, duration: 4, seek: async t => { map.jumpTo({ zoom: 12 + t * 0.9, bearing: -20 + t * 12, pitch: 60 });
    overlay.setProps({ layers: [new deck.ArcLayer({ id: 'a', data: [{ s: [-122.4, 37.77], e: [-97.09, 32.75] }], getSourcePosition: d => d.s, getTargetPosition: d => d.e, getWidth: 6, getSourceColor: [170,0,0], getTargetColor: [4,30,66] })] });
    await new Promise(r => map.once('idle', r)); } }; window.__ready = true;
  ```
  `canvasContextAttributes` is the v6 option name (confirmed in the installed `maplibre-gl.d.ts`).
- **As a layer:** map canvases are opaque. Use the map as the base plate, and put type and cutouts over it.
