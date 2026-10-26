from clips_worker.gpu.modal_inflight import ModalInflight, modal_inflight_limit


def test_modal_inflight_limit_default():
    assert modal_inflight_limit() >= 1


def test_modal_inflight_context():
    with ModalInflight():
        with ModalInflight():
            assert True
