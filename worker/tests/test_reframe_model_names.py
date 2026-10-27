import re
from pathlib import Path

import pytest

from clips_worker.reframe_models import SFACE_ONNX, YUNET_ONNX


def test_reframe_opens_models_listed_in_download_script():
    worker = Path(__file__).resolve().parents[1]
    script_path = worker / "scripts" / "download-models.sh"
    if not script_path.is_file():
        pytest.skip("download-models.sh missing from worker/scripts (not copied into image)")
    script = script_path.read_text(encoding="utf-8")
    downloaded = set(re.findall(r'\$DEST/([^\s"\']+\.onnx)', script))
    assert YUNET_ONNX in downloaded
    assert SFACE_ONNX in downloaded
    models_src = (worker / "clips_worker" / "reframe_models.py").read_text(encoding="utf-8")
    assert SFACE_ONNX in models_src
    assert YUNET_ONNX in models_src
    core_src = (worker / "clips_worker" / "reframe_core.py").read_text(encoding="utf-8")
    assert "reframe_models" in core_src
