# Motion Studio stock map data

Public-domain Natural Earth / world-atlas boundaries, pre-projected by Cinematic Skill
`make_map.py` (MIT). Used by generated scene code via `ctx.geo("world")` / `ctx.geo("us")`.
Board textures (cork, relief, …) are generated at runtime by `core/stock.py` (same
algorithm as the engine's `prep_assets.py`) and are not stored here.
