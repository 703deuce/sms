# transovo-gpu (Modal)

Deploy from the worker container (tokens in env only; never print values):

```bash
set +x
cd /app && modal deploy -m modal_app.app
```

Cost knobs (read at **deploy** time):

- `min_containers=0`, `scaledown_window=60` (default via `MODAL_SCALEDOWN_S`)
- `MODAL_GPU=L4`, `MODAL_MAX_CONTAINERS=2`
- Account budget: `MODAL_MONTHLY_BUDGET_USD=30` on the worker (95% guard in `gpu/budget.py`)

Smoke (live): `STREAMER_LIVE_TESTS=1 python scripts/modal_smoke.py`
