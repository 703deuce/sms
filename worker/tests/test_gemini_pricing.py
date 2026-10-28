from clips_worker.gemini_vision import gemini_token_pricing_usd
from clips_worker.video_picker import estimate_gemini_usd


def test_video_picker_pricing_models():
    assert gemini_token_pricing_usd("gemini-3.8-flash") == (0.75, 3.75)
    assert gemini_token_pricing_usd("gemini-3.5-flash-lite") == (0.30, 2.50)
    assert gemini_token_pricing_usd("gemini-2.5-flash") == (0.10, 0.40)


def test_estimate_gemini_usd_38_flash():
    # 1M in @ 0.75 + 1M out @ 3.75
    usd = estimate_gemini_usd(1_000_000, 1_000_000, "gemini-3.8-flash")
    assert abs(usd - 4.50) < 1e-6
