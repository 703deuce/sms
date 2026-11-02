"""Keep worker RENDER_PIPELINE_VERSION aligned with web CLIP_RENDER_PIPELINE_REV."""


def test_render_pipeline_version():
    from clips_worker.render_pipeline import RENDER_PIPELINE_VERSION

    from clips_worker.build_info import clips_worker_git_sha_short

    assert RENDER_PIPELINE_VERSION == f"t48-au33-v1-{clips_worker_git_sha_short()}"
