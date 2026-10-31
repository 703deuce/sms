from clips_worker.t6_geometry import _resolve_src, person_cell


def _face(x, y=0.3, w=0.08, h=0.14):
    return {"x": x, "y": y, "w": w, "h": h}


def test_cells_split_between_faces():
    faces = [_face(0.2), _face(0.7)]
    a = person_cell(faces, 0)
    b = person_cell(faces, 1)
    assert a["x"] == 0.0 and abs(a["x"] + a["w"] - 0.49) < 1e-3
    assert abs(b["x"] - 0.49) < 1e-3 and abs(b["x"] + b["w"] - 1.0) < 1e-3


def test_single_face_whole_frame():
    assert person_cell([_face(0.4)], 0) == {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}


def test_c5_person_crop_never_crosses_into_other_cam():
    # Side-by-side two-cam podcast; C5 panels are 1080x960 (aspect 1.125).
    faces = [_face(0.2, y=0.25, h=0.2), _face(0.72, y=0.25, h=0.2)]
    sig = {"faces": faces}
    mid = 0.5  # centres 0.24 / 0.76
    for idx in (0, 1):
        box, fit = _resolve_src(f"person:{idx}", sig, {"layout": {}}, 1080 / 960, role="a", panel_hfrac=0.5)
        assert fit is None
        if idx == 0:
            assert box["x"] + box["w"] <= mid + 1e-3
        else:
            assert box["x"] >= mid - 1e-3
        assert box["w"] > 0.1 and box["h"] > 0.1


def test_before_e6_full_frame_region_bled():
    # Documents the bug: the old full-frame region let person 0's crop pass the cam seam.
    from clips_worker.t6_geometry import DEFAULT_FULL, _face_crop

    faces = [_face(0.2, y=0.25, h=0.2), _face(0.72, y=0.25, h=0.2)]
    old = _face_crop(faces[0], 1080 / 960, dict(DEFAULT_FULL), face_frac=0.2)
    assert old["x"] + old["w"] > 0.5
