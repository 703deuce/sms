import re
from pathlib import Path


def test_reframe_opens_models_listed_in_download_script():
    worker = Path(__file__).resolve().parents[1]
    script = (worker / "scripts" / "download-models.sh").read_text(encoding="utf-8")
    downloaded = set(re.findall(r'\$DEST/([^\s"\']+\.onnx)', script))
    downloaded |= set(re.findall(r'\$DEST/([^\s"\']+\.task)', script))
    core_src = (worker / "clips_worker" / "reframe_core.py").read_text(encoding="utf-8")
    for name in ("yunet.onnx", "face_recognition_sface_2021dec.onnx"):
        assert name in core_src
        assert name in downloaded or name.replace("face_recognition_", "") in str(downloaded)
