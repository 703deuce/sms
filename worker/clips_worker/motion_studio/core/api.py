"""`motion_core`: the only engine surface generated (Part 2) scene code may import.

    from motion_core import *

Contract for generated code: define `build_scene(ctx)` returning `ctx.film()` populated with items and
camera keys. Time anchors come from `ctx.W(line_id, word, nth=0, end=False)` (raises on a miss).
"""
import math
import random

try:
    import numpy
    import skia
except ImportError:  # unit hosts may lack the worker image deps
    numpy = None  # type: ignore[assignment]
    skia = None  # type: ignore[assignment]

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

from clips_worker.motion_studio.core.api_manifest import format_api_reference, load_manifest

__all__ = [n for n in dir() if not n.startswith("_")]



API_REFERENCE = format_api_reference()
API_PITFALLS = API_REFERENCE  # same contract; kept as an alias for callers
