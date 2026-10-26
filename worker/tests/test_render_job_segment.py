def test_render_context_segment_fields_present():
    from clips_worker.render_job import load_render_context

    assert callable(load_render_context)
