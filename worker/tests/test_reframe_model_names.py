import re
from pathlib import Path

from clips_worker.reframe_models import SFACE_ONNX, YUNET_ONNX


def test_reframe_opens_models_listed_in_download_script():
    worker = Path(__file__).resolve().parents[1]
    script = (worker / "scripts" / "download-models.sh").read_text(encoding="utf-8")
    downloaded = set(re.findall(r'\$DEST/([^\s"\']+\.onnx)', script))
    assert YUNET_ONNX in downloaded
    assert SFACE_ONNX in downloaded
    core_src = (worker / "clips_worker" / "reframe_core.py").read_text(encoding="utf-8")
    assert SFACE_ONNX in core_src
    assert YUNET_ONNX in core_src
