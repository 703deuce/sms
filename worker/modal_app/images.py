import os

import modal

gpu_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.11")
    .apt_install("ffmpeg")
    .pip_install("faster-whisper>=1.1,<2", "requests>=2.32")
)

models = modal.Volume.from_name("transovo-models", create_if_missing=True)

MODAL_GPU = os.environ.get("MODAL_GPU", "L4")
MODAL_MAX_CONTAINERS = int(os.environ.get("MODAL_MAX_CONTAINERS", "2"))
MODAL_SCALEDOWN_S = int(os.environ.get("MODAL_SCALEDOWN_S", "60"))
MODAL_STREAM_SCALEDOWN_S = int(os.environ.get("MODAL_STREAM_SCALEDOWN_S", "30"))

diarize_image = gpu_image.pip_install(
    "pyannote.audio>=3.1,<4",
    "torch>=2.1",
    "torchaudio>=2.1",
)
