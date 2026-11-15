"""`motion_core`: the only engine surface generated (Part 2) scene code may import.

    from motion_core import *

Contract for generated code: define `build_scene(ctx)` returning `ctx.film()` populated with items and
camera keys. Time anchors come from `ctx.W(line_id, word, nth=0, end=False)` (raises on a miss).
"""
from clips_worker.motion_studio.vendor.cinematic_skill.engine import (  # noqa: F401  (world items for Part 2)
    Board, Cached, Chalk, GeoMap, Holes, Ledger, LOOKS, MAP_LOOKS, OpenLedger, Print, RegionFill,
    CREAM, WHITE, RUST, MUSTARD, HILITE, RED, INK, TEAL,
)

from clips_worker.motion_studio.core.world import (  # noqa: F401
    HOUSE, LinearAxis, StudioFilm, CR, keys_on_words, mercator, tile_positions,
)
from clips_worker.motion_studio.core.blocks import (  # noqa: F401
    BarSeries, BigText, Callout, Card, ChapterCard, Connector, Counter, DotField, EmphasisMark, FieldSpread, FilmFrame,
    GradientField, GridField, HeroSlam, Item, LineSeries, LowerThird, MapPin, NoiseTexture, Panel, PaperDoc, PenMark,
    ParticleDrift, PhotoFrame, RollingNumber, Route, ScreenItem, Stamp, StringLine, XMarker, SAMPLING, clamp, color,
    ease_in_out, ease_out_back, ease_out_cubic, hexrgb, legible, look_from_style, paint, partial_path, per_frame_grain,
    ramp, rot_point, rrect, spring, text, text_width,
)

__all__ = [n for n in dir() if not n.startswith("_")]

API_REFERENCE = '''
motion_core API (Cinematic Skill engine + Transovo Part 1 blocks). World units = 4K px at zoom 1; frame is 3840x2160 world px at zoom 1.
ctx: duration, fps, width, height, seed, style (dict), palette {bg,ink,accent,accent2,muted} as (r,g,b),
     lines [{id,text,spoken,start,end,hero,typed}] (scene-local seconds), words [{w,s,e,line}], emphasis [{lineId,word,t}],
     assets {key: {kind,w,h,description}} (photo keys usable in PhotoFrame), data [{label,value,unit,source}],
     scene {id,visualType,description,blocks}, ctx.W(line_id, word, nth=0, end=False)->seconds (raises if missing),
     ctx.film(drift=1.0, wobble=1.0) -> StudioFilm, ctx.rgb(name)->(r,g,b), ctx.rand -> seeded random.Random
StudioFilm: add(item); cam(t,x,y,zoom,rot=0); shot(t,x,y,zoom,rot=0,radius=None,strength=0.55) (camera+spotlight, ONE hero per beat);
     focus(t,x,y,radius,strength); shake(t,amp=14,dur=0.35); cue(kind,t,gain=1.0, dur=None)
     (kinds: pop whoosh slide impact boom ticks riser stamp shimmer drop marker pencil tick snip click heartbeat clock;
      riser peaks at t+dur — start it ~1.3s before the hit). damp(t0,t1,factor=0.15). Need >= 2 camera keys spanning 0..duration.
     Typical zoom 0.25 (wide) .. 1.6 (tight). ctx.film() already has organic drift + handheld wobble; do not set fade_in/fade_out.
     Colours: CREAM WHITE RUST MUSTARD HILITE RED INK TEAL, or invent from ctx.palette. LOOKS / MAP_LOOKS are starting points; prefer a look dict from the palette.
Background systems (z<0): GradientField(colors,center=(0,0),radius=12000,linear=False), GridField(spacing=400,rgb,alpha=0.06,major=5),
     ParticleDrift(area=(x,y,w,h),n=160,rgb,alpha=0.25,r=(6,26),speed=40,seed=3), NoiseTexture(seed,alpha=0.08,rgb)
Blocks: HeroSlam(s,x,y,size,t_in,t_out=None,font='cond',rgb,glow=0.4,words=[(word,t),...])
     RollingNumber(x,y,size,v0,v1,t_in,t_land,fmt='{:,.0f}',prefix='',suffix='',caption=None,rgb)  (t_land = spoken word time)
     Callout(s,x,y,t_in,t_out=None,side='right',size=96,rgb,accent)  EmphasisMark(kind('circle'|'underline'|'flash'|'stamp'),x,y,w,h,t,rgb,label='')
     Connector(a,b,t_in,dur=0.8,bend=0.18,width=8,rgb,dashed=False)  FieldSpread(points,t0,t1,rgb,r=18,seed)
     PhotoFrame(key,x,y,w,rot=0,t_in=0,t_out=None,skin('print'|'glass'|'tv'|'filmstrip'|'plain'),title='',label='',crop=None)
     Panel(x,y,w,h,t_in,title='',content=fn(c,res,t,w,h,a),accent)  LineSeries(pts,t0,t1,rgb,width=14,fill_to=None)
     BarSeries(xs,heights,base_y,width,t0,stagger=0.08,rgb,labels=None)  LowerThird(name,role,t_in,t_out)  ChapterCard(n,title,t_in,t_out)
     Engine items: BigText(text,x,y,size,t_in, type_on=0, hit=None, bar=None, bar_h=None, grunge=True),
     Counter(x,y,size,value,t_in,prefix,suffix,caption,dur), MapPin(x,y,label,t_in), Route(a,b,t_in,dur),
     StringLine(a,b,t_in, persist=False), PenMark(kind,x,y,w,h,t_in) (ellipse|underline|strike|arrow|highlight),
     Stamp(text,x,y,size,rot,t_in), Card, PaperDoc (phrase_spans(res, phrase) for highlights), DotField, FilmFrame(print,t_in),
     Print(key,x,y,w,rot,t_in, paper=False, pin=True, label=None, label_t=None), XMarker, Chalk, Holes, Ledger, OpenLedger.
     Cached: subclass for a big static drawing (street plan, floor, chart grid) so it is drawn once and reused.
Axes/projection: LinearAxis(v0,v1,p0,p1,log=False)(v)->world coord, .ticks(n); mercator(lon,lat,scale=20000)
Custom items: subclass Item: __init__(t_in,t_out,z,sfx) ; bounds(res)->skia.Rect|None ; draw(c,res,t) using skia canvas c (world coords);
     ALWAYS draw text with text(c,res,s,x,y,size,font,rgb,a,track=0,align='left'|'center'|'right') (fonts: cond label labelm mono serif).
     paint(rgb,a,stroke=None,blur=None) -> skia.Paint ; ramp(t,t0,dur) ; spring(t,t0,dur) ; ease_* ; rrect(x,y,w,h,r)
Rules: text cap height must be >= 40 px at 1080p (size*0.72*zoom/2 >= 40 -> at zoom 0.5 use size >= 230); keep text inside frame;
     never leave the frame as a lone hero on an empty field: always 3 layers (procedural background system, midground context, foreground hero);
     seeded randomness only (ctx.rand / seed=ctx.seed); no file, network or OS access; numpy/math/random/skia allowed.

World / map items (use these; do not reimplement a map): GeoMap(data, K, origin=(0,0), look='explainer'|'period'|dict),
     RegionFill(geomap, names, rgb, t_in, t_out=None, to_rgb=None, t_change=None),
     Board(texture='cork_dark.png'|'slate.png'|'charcoal.png'|'paper.png'|'studio.png'|'night.png'|'blueprint.png'),
     Print(key, x, y, w, rot=0, t_in, t_out=None, paper=False, pin=True, label=None), Ledger, OpenLedger, Chalk, Holes.
     ctx.geo(name='world'|'us', K=20000, origin=(0,0), look=...) -> GeoMap already loaded from stock data.
     ctx.place(geomap, 'Chicago') -> (x,y) for a named place (raises if missing).
     ctx.ll(geomap, lat, lon) -> (x,y) for any WGS84 coordinate on that map.
     ctx.maps is ('world','us'). Prefer inventing a look dict (sheet/water/land/border colours) from the story palette
     rather than the default explainer/period looks. Add Route, MapPin, XMarker, StringLine between places.
'''
