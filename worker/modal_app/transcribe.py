import os
import time

import modal

from modal_app.app import app
from modal_app.images import MODAL_GPU, MODAL_MAX_CONTAINERS, MODAL_SCALEDOWN_S, gpu_image, models


@app.cls(
    image=gpu_image,
    gpu=MODAL_GPU,
    volumes={"/models": models},
    min_containers=0,
    buffer_containers=0,
    max_containers=MODAL_MAX_CONTAINERS,
    scaledown_window=MODAL_SCALEDOWN_S,
    timeout=3600,
)
class Transcriber:
    @modal.enter()
    def load(self):
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        model_name = os.environ.get("WHISPER_GPU_MODEL", "large-v3")
        self.model = WhisperModel(
            model_name,
            device="cuda",
            compute_type="float16",
            download_root="/models",
        )
        self.pipe = BatchedInferencePipeline(model=self.model)

    @modal.method()
    def transcribe(self, audio_url: str, language: str | None, initial_prompt: str | None) -> dict:
        from modal_app.common import fetch

        t0 = time.time()
        path = fetch(audio_url)
        batch = int(os.environ.get("WHISPER_GPU_BATCH", "16"))
        segs, info = self.pipe.transcribe(
            str(path),
            batch_size=batch,
            word_timestamps=True,
            vad_filter=True,
            language=language,
            initial_prompt=initial_prompt,
        )
        words = [
            {"word": w.word, "start": w.start, "end": w.end, "prob": w.probability}
            for s in segs
            for w in (s.words or [])
        ]
        path.unlink(missing_ok=True)
        return {
            "words": words,
            "language": info.language,
            "duration_s": info.duration,
            "gpu_seconds": time.time() - t0,
        }
