"""ONNX model basenames shipped by worker/scripts/download-models.sh."""
from __future__ import annotations

import os

YUNET_ONNX = "yunet.onnx"
SFACE_ONNX = "face_recognition_sface_2021dec.onnx"
SFACE_LEGACY_ONNX = "sface.onnx"


def resolve_onnx(models_dir: str, primary: str, legacy: str | None = None) -> str:
    path = os.path.join(models_dir, primary)
    if os.path.isfile(path):
        return path
    if legacy:
        alt = os.path.join(models_dir, legacy)
        if os.path.isfile(alt):
            return alt
    return path
