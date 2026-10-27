import numpy as np

from clips_worker.reframe_core import _person_boxes_to_face_rows, person_detector_enabled


def test_person_detector_off_by_default():
    assert not person_detector_enabled({})
    assert not person_detector_enabled({"REFRAME_PERSON_DET": ""})
    assert person_detector_enabled({"REFRAME_PERSON_DET": "1"})
    assert person_detector_enabled({"REFRAME_PERSON_DET": "true"})


def test_person_boxes_to_face_rows_shape_and_scale():
    rows = _person_boxes_to_face_rows([(10.0, 20.0, 100.0, 200.0)], scale=0.5)
    assert rows.shape == (1, 15)
    assert abs(rows[0, 14] - 0.55) < 1e-6
    assert rows[0, 0] == 20.0
    assert rows[0, 3] >= 24.0
