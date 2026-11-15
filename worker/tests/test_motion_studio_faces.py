"""G2 faces: detect with the clipper's YuNet + SFace, group the same person across assets, never raise."""
import os
from pathlib import Path

import numpy as np
import pytest

from clips_worker.motion_studio.pipeline import faces as F

FIX = Path(__file__).parent / "fixtures" / "faces" / "astronaut_pd.jpg"
needs_models = pytest.mark.skipif(F._models() is None, reason="face models not installed (present in the worker image)")


@needs_models
def test_detect_and_group_same_person(tmp_path):
    import cv2
    im = cv2.imread(str(FIX))
    variant = tmp_path / "variant.jpg"
    cv2.imwrite(str(variant), cv2.flip(cv2.resize(im[0:200, 60:260], (300, 300)), 1))
    noise = tmp_path / "noise.png"
    cv2.imwrite(str(noise), (np.random.default_rng(1).random((240, 320, 3)) * 255).astype(np.uint8))
    a, b, n = F.detect(str(FIX), "image"), F.detect(str(variant), "image"), F.detect(str(noise), "image")
    assert a["status"] == "done" and len(a["items"]) == 1 and len(a["items"][0]["emb"]) == 128
    assert b["status"] == "done" and len(b["items"]) == 1
    assert n["status"] == "done" and n["items"] == []
    labelled, people = F.group([{"id": "a", "faces": a["items"]}, {"id": "b", "faces": b["items"]}, {"id": "n", "faces": []}])
    assert len(people) == 1 and sorted(people[0]["assetIds"]) == ["a", "b"]
    assert labelled["a"][0]["person"] == labelled["b"][0]["person"] == "P1"


def test_group_separates_people_and_detect_never_raises(tmp_path):
    e1, e2 = np.zeros(128), np.zeros(128)
    e1[0], e2[1] = 1, 1
    f = lambda e: {"box": [0.1, 0.1, 0.2, 0.2], "score": 0.9, "t": None, "emb": list(e)}  # noqa: E731
    _, people = F.group([{"id": "x", "faces": [f(e1), f(e2)]}, {"id": "y", "faces": [f(e1)]}])
    assert [p["count"] for p in people] == [2, 1] or [p["count"] for p in people] == [1, 2]
    assert F.detect(str(tmp_path / "missing.jpg"), "image")["status"] in ("done", "unavailable", "error")
    assert F.detect(os.devnull, "audio")["status"] == "skipped"
