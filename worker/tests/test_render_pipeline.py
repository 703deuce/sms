"""Keep worker RENDER_PIPELINE_VERSION aligned with web CLIP_RENDER_PIPELINE_REV."""


def test_render_pipeline_version():
    from clips_worker.render_pipeline import RENDER_PIPELINE_VERSION

    assert RENDER_PIPELINE_VERSION == "t47-v2"
