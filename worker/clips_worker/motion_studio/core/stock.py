"""Stock maps and board textures for Part 2 scene code (RE-11).

Map JSON is public-domain Natural Earth / world-atlas data, pre-projected by Cinematic Skill
make_map.py. Board textures are generated with the same algorithm as the engine's prep_assets.py
(no downloaded images) and cached on disk. Generated code reaches these only through ctx.geo /
ctx.ll / ctx.place, or by reading files the parent copied into the sandbox assets_dir.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MAPS_DIR = HERE / "assets" / "maps"
CACHE_DIR = Path(os.environ.get("MOTION_STUDIO_ASSET_CACHE") or "/tmp/motion_studio_assets")

# Extra well-known places, merged into a loaded map if the name is not already present.
# (lat, lon) in WGS84. Projection is applied with the map's own projector.
WORLD_PLACES: dict[str, tuple[float, float]] = {
    "Chicago": (41.88, -87.63), "London": (51.51, -0.13), "Brooklyn": (40.68, -73.94),
    "Toronto": (43.65, -79.38), "Atlanta": (33.75, -84.39), "Paris": (48.86, 2.35),
    "Amsterdam": (52.37, 4.90), "Dublin": (53.35, -6.26), "Berlin": (52.52, 13.40),
    "Los Angeles": (34.05, -118.24), "Houston": (29.76, -95.37), "Stockholm": (59.33, 18.06),
    "Madrid": (40.42, -3.70), "Lagos": (6.52, 3.38), "Accra": (5.60, -0.19),
    "Montreal": (45.50, -73.57), "New York": (40.71, -74.01), "Washington": (38.91, -77.04),
    "Miami": (25.76, -80.19), "Boston": (42.36, -71.06), "San Francisco": (37.77, -122.42),
    "Seattle": (47.61, -122.33), "Vancouver": (49.28, -123.12), "Mexico City": (19.43, -99.13),
    "São Paulo": (-23.55, -46.63), "Sao Paulo": (-23.55, -46.63), "Buenos Aires": (-34.60, -58.38),
    "Lima": (-12.05, -77.04), "Tokyo": (35.68, 139.69), "Seoul": (37.57, 126.98),
    "Beijing": (39.90, 116.40), "Shanghai": (31.23, 121.47), "Hong Kong": (22.32, 114.17),
    "Singapore": (1.35, 103.82), "Mumbai": (19.08, 72.88), "New Delhi": (28.61, 77.21),
    "Delhi": (28.61, 77.21), "Bangkok": (13.76, 100.50), "Jakarta": (-6.21, 106.85),
    "Manila": (14.60, 120.98), "Sydney": (-33.87, 151.21), "Melbourne": (-37.81, 144.96),
    "Auckland": (-36.85, 174.76), "Cairo": (30.04, 31.24), "Johannesburg": (-26.20, 28.05),
    "Cape Town": (-33.92, 18.42), "Nairobi": (-1.29, 36.82), "Casablanca": (33.57, -7.59),
    "Addis Ababa": (9.03, 38.74), "Moscow": (55.76, 37.62), "Istanbul": (41.01, 28.98),
    "Rome": (41.90, 12.50), "Vienna": (48.21, 16.37), "Warsaw": (52.23, 21.01),
    "Prague": (50.08, 14.44), "Lisbon": (38.72, -9.14), "Oslo": (59.91, 10.75),
    "Copenhagen": (55.68, 12.57), "Helsinki": (60.17, 24.94), "Athens": (37.98, 23.73),
    "Kyiv": (50.45, 30.52), "Dubai": (25.20, 55.27), "Riyadh": (24.71, 46.68),
    "Tel Aviv": (32.09, 34.78), "Tehran": (35.69, 51.39), "Baghdad": (33.32, 44.37),
    "Karachi": (24.86, 67.01), "Dhaka": (23.81, 90.41), "Reykjavik": (64.15, -21.94),
}

US_PLACES: dict[str, tuple[float, float]] = {
    "New York": (40.71, -74.01), "Los Angeles": (34.05, -118.24), "Chicago": (41.88, -87.63),
    "Houston": (29.76, -95.37), "Washington": (38.91, -77.04), "Miami": (25.76, -80.19),
    "Boston": (42.36, -71.06), "San Francisco": (37.77, -122.42), "Seattle": (47.61, -122.33),
    "Atlanta": (33.75, -84.39), "Dallas": (32.78, -96.80), "Denver": (39.74, -104.99),
    "Phoenix": (33.45, -112.07), "Philadelphia": (39.95, -75.17), "Detroit": (42.33, -83.05),
    "Minneapolis": (44.98, -93.27), "New Orleans": (29.95, -90.07), "Las Vegas": (36.17, -115.14),
    "Dayton": (39.76, -84.19),
}

TEXTURES = ("cork.png", "cork_dark.png", "paper.png", "slate.png", "charcoal.png",
            "relief.png", "studio.png", "night.png", "blueprint.png")


def projector(spec: dict):
    """Same projectors as cinematic-skill make_map.py (y down)."""
    t = (spec or {}).get("type", "mercator")
    r = math.radians
    if t == "albers":
        lon0 = float(spec.get("lon0", -96.0)); lat0 = float(spec.get("lat0", 37.5))
        p1 = float(spec.get("p1", 29.5)); p2 = float(spec.get("p2", 45.5))
        n = (math.sin(r(p1)) + math.sin(r(p2))) / 2
        c = math.cos(r(p1)) ** 2 + 2 * n * math.sin(r(p1))
        rho0 = math.sqrt(c - 2 * n * math.sin(r(lat0))) / n

        def f(lon, lat):
            rho = math.sqrt(max(0.0, c - 2 * n * math.sin(r(lat)))) / n
            th = n * r(lon - lon0)
            return rho * math.sin(th), -(rho0 - rho * math.cos(th))
        return f
    if t == "equirect":
        lon0 = float(spec.get("lon0", 0.0)); lat0 = float(spec.get("lat0", 0.0))
        k = math.cos(r(lat0))
        return lambda lon, lat: (r(lon - lon0) * k, -r(lat - lat0))
    lon0 = float((spec or {}).get("lon0", 0.0))
    return lambda lon, lat: (r(lon - lon0), -math.log(math.tan(math.pi / 4 + r(max(-85.0, min(85.0, lat))) / 2)))


def available_maps() -> list[str]:
    names = []
    for p in sorted(MAPS_DIR.glob("map_*.json")):
        names.append(p.stem[len("map_"):])
    return names


def _merge_places(data: dict, extras: dict[str, tuple[float, float]]) -> dict:
    proj = projector(data.get("projection") or {})
    places = dict(data.get("places") or {})
    for name, (lat, lon) in extras.items():
        if name not in places:
            x, y = proj(lon, lat)
            places[name] = [round(x, 6), round(y, 6)]
    out = dict(data)
    out["places"] = places
    return out


def load_map(name: str) -> dict:
    key = (name or "world").strip().lower()
    path = MAPS_DIR / f"map_{key}.json"
    if not path.is_file():
        raise KeyError(f"no stock map named {name!r}; have {available_maps()}")
    data = json.loads(path.read_text())
    extras = WORLD_PLACES if key == "world" else US_PLACES if key in ("us", "usa", "united_states") else {}
    return _merge_places(data, extras)


def project_ll(data: dict, lat: float, lon: float) -> tuple[float, float]:
    return projector(data.get("projection") or {})(lon, lat)


def geo_ll(geomap, lat: float, lon: float) -> tuple[float, float]:
    """World-space (x, y) on an already-constructed GeoMap for a WGS84 point."""
    x, y = project_ll(geomap.data, lat, lon)
    return geomap.w((x, y))


# ------------------------------------------------------------------ textures (prep_assets.py, vendored algorithm, no samples)
def _tile_noise(size, scale, seed):
    import numpy as np
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size)[:, None]
    fy = np.fft.fftfreq(size)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2) * size / scale
    out = np.real(np.fft.ifft2(np.fft.fft2(n) * np.exp(-f ** 2)))
    return (out - out.mean()) / (out.std() + 1e-9)


def _ensure_textures(dest: Path, size: int = 1024) -> None:
    from PIL import Image, ImageFilter
    import numpy as np

    dest.mkdir(parents=True, exist_ok=True)

    def tile_noise(scale, seed):
        return _tile_noise(size, scale, seed)

    def save(name, arr):
        p = dest / name
        if p.exists():
            return
        im = arr if isinstance(arr, Image.Image) else Image.fromarray(arr.astype(np.uint8))
        im.save(p)

    if not (dest / "cork.png").exists() or not (dest / "cork_dark.png").exists():
        base = np.array([92, 62, 38], np.float32)
        n = 0.55 * tile_noise(40, 1) + 0.35 * tile_noise(12, 2) + 0.25 * tile_noise(3, 3)
        speck = np.random.default_rng(4).random((size, size))
        dark = (speck > 0.985).astype(np.float32) * -0.9 + (speck < 0.012).astype(np.float32) * 0.5
        dark = np.asarray(Image.fromarray(((dark + 1) * 127).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)),
                          np.float32) / 127 - 1
        v = n * 0.16 + dark * 0.35
        cork = (base[None, None, :] * (1 + v[..., None])).clip(0, 255)
        save("cork.png", cork)
        lum = cork.mean(axis=2, keepdims=True)
        darkc = (lum + (cork - lum) * 0.55) * 0.45 + np.array([12, 10, 9]) * 0.55
        save("cork_dark.png", darkc)
    if not (dest / "paper.png").exists():
        base = np.array([232, 229, 222], np.float32)
        n = 0.5 * tile_noise(60, 11) + 0.3 * tile_noise(8, 12) + 0.2 * tile_noise(2, 13)
        rng = np.random.default_rng(14)
        fib = np.zeros((size, size), np.float32)
        for _ in range(900):
            x, y = rng.integers(0, size, 2)
            ang = rng.random() * math.pi
            ln = int(rng.integers(6, 22))
            for k in range(ln):
                fib[int(y + k * math.sin(ang)) % size, int(x + k * math.cos(ang)) % size] += 1
        fib = np.asarray(Image.fromarray((fib.clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)),
                         np.float32) / 255
        save("paper.png", (base[None, None, :] * (1 + (n * 0.035 - fib * 0.05)[..., None])).clip(0, 255))

    def flat(rgb, seed, amount=0.08):
        n = 0.6 * tile_noise(50, seed) + 0.3 * tile_noise(10, seed + 1) + 0.2 * tile_noise(2, seed + 2)
        return (np.array(rgb, np.float32)[None, None, :] * (1 + n[..., None] * amount)).clip(0, 255)

    if not (dest / "slate.png").exists():
        save("slate.png", flat((34, 40, 46), 21))
    if not (dest / "charcoal.png").exists():
        save("charcoal.png", flat((30, 29, 28), 31, 0.12))
    if not (dest / "studio.png").exists():
        save("studio.png", flat((222, 220, 216), 51, 0.025))
    if not (dest / "night.png").exists():
        save("night.png", flat((16, 20, 32), 61, 0.1))
    if not (dest / "blueprint.png").exists():
        a = flat((22, 52, 98), 71, 0.06)
        grid = np.zeros((size, size), np.float32)
        for k in range(0, size, 64):
            w = 0.5 if k % 256 == 0 else 0.22
            grid[:, k:k + 2] = np.maximum(grid[:, k:k + 2], w)
            grid[k:k + 2, :] = np.maximum(grid[k:k + 2, :], w)
        save("blueprint.png", (a + grid[..., None] * np.array([120, 160, 200], np.float32)).clip(0, 255))
    if not (dest / "relief.png").exists():
        n = 0.6 * tile_noise(90, 41) + 0.3 * tile_noise(30, 42) + 0.15 * tile_noise(8, 43)
        gy = (np.roll(n, -1, 0) - np.roll(n, 1, 0)) / 2
        gx = (np.roll(n, -1, 1) - np.roll(n, 1, 1)) / 2
        shade = np.clip(0.5 + (gx * -1.0 + gy * -1.0) * 1.6, 0, 1)
        save("relief.png", Image.fromarray((shade * 255).astype(np.uint8)))


def materialize(assets_dir: str | Path, *, maps: bool = True, textures: bool = True) -> Path:
    """Copy stock maps and (generated) textures into a sandbox assets_dir so Res.image / ctx.geo work."""
    dest = Path(assets_dir)
    dest.mkdir(parents=True, exist_ok=True)
    if maps:
        for src in MAPS_DIR.glob("map_*.json"):
            dst = dest / src.name
            if not dst.exists():
                dst.write_bytes(src.read_bytes())
    if textures:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _ensure_textures(CACHE_DIR)
        for name in TEXTURES:
            src = CACHE_DIR / name
            dst = dest / name
            if src.exists() and not dst.exists():
                dst.write_bytes(src.read_bytes())
    return dest


def map_catalog() -> dict:
    """Compact description for the Motion Designer brief (no geometry)."""
    out = {}
    for name in available_maps():
        data = load_map(name)
        out[name] = {"places": sorted(data.get("places") or {}),
                     "regions": sorted(list(data.get("regions") or {})),
                     "regionCount": len(data.get("regions") or {}),
                     "projection": (data.get("projection") or {}).get("type")}
    return out
