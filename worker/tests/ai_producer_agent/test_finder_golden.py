"""Golden parity: copied finder exposes the same public helpers as clipper video_picker."""

from __future__ import annotations

import inspect

from clips_worker import video_picker as orig
from clips_worker.ai_producer_agent.finder import watch as copy


def test_watch_copy_exports_core_symbols():
    for name in (
        "watch_video_file",
        "watch_upload_range",
        "make_watch_proxy",
        "validate_and_normalize_moments",
        "merge_stream_moments",
        "estimate_gemini_usd",
    ):
        assert hasattr(copy, name), name
        assert callable(getattr(copy, name))
        assert inspect.signature(getattr(orig, name)) == inspect.signature(getattr(copy, name)), name
