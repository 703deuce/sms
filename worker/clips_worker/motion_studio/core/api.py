"""`motion_core`: the only engine surface generated (Part 2) scene code may import.

    from motion_core import *

Contract for generated code: define `build_scene(ctx)` returning `ctx.film()` populated with items and
camera keys. Time anchors come from `ctx.W(line_id, word, nth=0, end=False)` (raises on a miss).
"""
from clips_worker.motion_studio.core.world import (  # noqa: F401
    HOUSE, LinearAxis, StudioFilm, CR, keys_on_words, mercator, tile_positions,
)
from clips_worker.motion_studio.core.blocks import (  # noqa: F401
    BarSeries, BigText, Callout, Card, ChapterCard, Connector, Counter, DotField, EmphasisMark, FieldSpread, FilmFrame,
    GradientField, GridField, HeroSlam, Item, LineSeries, LowerThird, MapPin, NoiseTexture, Panel, PaperDoc, PenMark,
    ParticleDrift, PhotoFrame, RollingNumber, Route, ScreenItem, Stamp, StringLine, XMarker, SAMPLING, clamp, color,
    ease_in_out, ease_out_back, ease_out_cubic, hexrgb, legible, look_from_style, paint, partial_path, ramp, rot_point,
    rrect, spring, text, text_width,
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
     focus(t,x,y,radius,strength); shake(t,amp=14,dur=0.35); cue(kind,t,gain=1.0) (kinds: pop whoosh slide impact boom ticks riser stamp shimmer drop marker pencil);
     damp(t0,t1,factor=0.15). Need >= 2 camera keys spanning 0..duration. Typical zoom 0.25 (wide) .. 1.6 (tight).
Background systems (z<0): GradientField(colors,center=(0,0),radius=12000,linear=False), GridField(spacing=400,rgb,alpha=0.06,major=5),
     ParticleDrift(area=(x,y,w,h),n=160,rgb,alpha=0.25,r=(6,26),speed=40,seed=3), NoiseTexture(seed,alpha=0.08,rgb)
Blocks: HeroSlam(s,x,y,size,t_in,t_out=None,font='cond',rgb,glow=0.4,words=[(word,t),...])
     RollingNumber(x,y,size,v0,v1,t_in,t_land,fmt='{:,.0f}',prefix='',suffix='',caption=None,rgb)  (t_land = spoken word time)
     Callout(s,x,y,t_in,t_out=None,side='right',size=96,rgb,accent)  EmphasisMark(kind('circle'|'underline'|'flash'|'stamp'),x,y,w,h,t,rgb,label='')
     Connector(a,b,t_in,dur=0.8,bend=0.18,width=8,rgb,dashed=False)  FieldSpread(points,t0,t1,rgb,r=18,seed)
     PhotoFrame(key,x,y,w,rot=0,t_in=0,t_out=None,skin('print'|'glass'|'tv'|'filmstrip'|'plain'),title='',label='',crop=None)
     Panel(x,y,w,h,t_in,title='',content=fn(c,res,t,w,h,a),accent)  LineSeries(pts,t0,t1,rgb,width=14,fill_to=None)
     BarSeries(xs,heights,base_y,width,t0,stagger=0.08,rgb,labels=None)  LowerThird(name,role,t_in,t_out)  ChapterCard(n,title,t_in,t_out)
     Engine items: BigText, Counter, MapPin(x,y,label,t_in), Route(a,b,t_in,dur), StringLine, PenMark, Stamp(text,x,y,size,rot,t_in), Card, PaperDoc, DotField
Axes/projection: LinearAxis(v0,v1,p0,p1,log=False)(v)->world coord, .ticks(n); mercator(lon,lat,scale=20000)
Custom items: subclass Item: __init__(t_in,t_out,z,sfx) ; bounds(res)->skia.Rect|None ; draw(c,res,t) using skia canvas c (world coords);
     ALWAYS draw text with text(c,res,s,x,y,size,font,rgb,a,track=0,align='left'|'center'|'right') (fonts: cond label labelm mono serif).
     paint(rgb,a,stroke=None,blur=None) -> skia.Paint ; ramp(t,t0,dur) ; spring(t,t0,dur) ; ease_* ; rrect(x,y,w,h,r)
Rules: text cap height must be >= 40 px at 1080p (size*0.72*zoom/2 >= 40 -> at zoom 0.5 use size >= 230); keep text inside frame;
     never leave the frame as a lone hero on an empty field: always 3 layers (procedural background system, midground context, foreground hero);
     seeded randomness only (ctx.rand / seed=ctx.seed); no file, network or OS access; numpy/math/random/skia allowed.
'''
