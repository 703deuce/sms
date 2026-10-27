import os
import time

import modal

from modal_app.app import app
from modal_app.images import (
    MODAL_GPU,
    MODAL_MAX_CONTAINERS,
    MODAL_SCALEDOWN_S,
    MODAL_STREAM_SCALEDOWN_S,
    diarize_image,
    gpu_image,
    models,
)


def _assign_speakers(words: list[dict], annotation) -> list[dict]:
    """Map pyannote diarization onto word midpoints."""
    segments: list[tuple[float, float, int]] = []
    for segment, _, label in annotation.itertracks(yield_label=True):
        spk_raw = str(label)
        digits = "".join(ch for ch in spk_raw if ch.isdigit())
        spk = int(digits) if digits else 0
        segments.append((float(segment.start), float(segment.end), spk))
    for w in words:
        mid = (float(w["start"]) + float(w["end"])) / 2.0
        spk = 0
        for s, e, label in segments:
            if s <= mid <= e:
                spk = label
                break
        w["speaker"] = spk
    return words


def _run_whisper(pipe, path, language, initial_prompt, batch: int) -> tuple[list[dict], object]:
    segs, info = pipe.transcribe(
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
    return words, info


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
    """Regular clipper uploads (default WHISPER_GPU_MODEL at deploy)."""

    @modal.enter()
    def load(self):
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        self._model_name = os.environ.get("WHISPER_GPU_MODEL", "large-v3")
        self._load_model(self._model_name)

    def _load_model(self, model_name: str) -> None:
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        if getattr(self, "_loaded_name", None) == model_name:
            return
        t0 = time.time()
        self.model = WhisperModel(
            model_name,
            device="cuda",
            compute_type="float16",
            download_root="/models",
        )
        self.pipe = BatchedInferencePipeline(model=self.model)
        self._loaded_name = model_name
        self._last_load_s = time.time() - t0

    @modal.method()
    def transcribe(self, audio_url: str, language: str | None, initial_prompt: str | None) -> dict:
        from modal_app.common import fetch

        t0 = time.time()
        path = fetch(audio_url)
        batch = int(os.environ.get("WHISPER_GPU_BATCH", "16"))
        words, info = _run_whisper(self.pipe, path, language, initial_prompt, batch)
        path.unlink(missing_ok=True)
        return {
            "words": words,
            "language": info.language,
            "duration_s": info.duration,
            "gpu_seconds": time.time() - t0,
            "cold_start_s": float(getattr(self, "_last_load_s", 0.0)),
            "whisper_model": getattr(self, "_loaded_name", None),
            "diarized": False,
        }


@app.cls(
    image=diarize_image,
    gpu=MODAL_GPU,
    volumes={"/models": models},
    min_containers=0,
    buffer_containers=0,
    max_containers=MODAL_MAX_CONTAINERS,
    scaledown_window=MODAL_STREAM_SCALEDOWN_S,
    timeout=3600,
)
class StreamTranscriber:
    """Streamer full-VOD: faster-whisper (STREAM_WHISPER_GPU_MODEL) + optional pyannote diarize."""

    @modal.enter()
    def load(self):
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        self._diarize_pipeline = None
        model_name = os.environ.get("STREAM_WHISPER_GPU_MODEL") or os.environ.get(
            "WHISPER_GPU_MODEL", "large-v3-turbo"
        )
        t0 = time.time()
        self.model = WhisperModel(
            model_name,
            device="cuda",
            compute_type="float16",
            download_root="/models",
        )
        self.pipe = BatchedInferencePipeline(model=self.model)
        self._model_name = model_name
        self._cold_start_s = time.time() - t0

    def _diarize(self, audio_path: str):
        if self._diarize_pipeline is None:
            from pyannote.audio import Pipeline

            token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
            if not token:
                raise RuntimeError("hf_token_missing")
            # pyannote/speaker-diarization-3.1 — accept license on Hugging Face; set HF_TOKEN on Modal secret.
            self._diarize_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=token,
            )
        return self._diarize_pipeline(audio_path)

    @modal.method()
    def transcribe(
        self,
        audio_url: str,
        language: str | None,
        initial_prompt: str | None,
        *,
        diarize: bool = False,
        whisper_model: str | None = None,
    ) -> dict:
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        from modal_app.common import fetch

        t0 = time.time()
        cold = float(getattr(self, "_cold_start_s", 0.0))
        want_model = whisper_model or getattr(self, "_model_name", "large-v3-turbo")
        if want_model != getattr(self, "_model_name", None):
            self.model = WhisperModel(
                want_model,
                device="cuda",
                compute_type="float16",
                download_root="/models",
            )
            self.pipe = BatchedInferencePipeline(model=self.model)
            self._model_name = want_model
            cold += time.time() - t0

        path = fetch(audio_url)
        batch = int(os.environ.get("WHISPER_GPU_BATCH", "16"))
        words, info = _run_whisper(self.pipe, path, language, initial_prompt, batch)
        diarized = False
        if diarize and words:
            try:
                annotation = self._diarize(str(path))
                words = _assign_speakers(words, annotation)
                diarized = True
            except Exception as exc:
                path.unlink(missing_ok=True)
                raise RuntimeError(f"diarize_failed:{type(exc).__name__}") from exc
        path.unlink(missing_ok=True)
        gpu_s = time.time() - t0
        return {
            "words": words,
            "language": info.language,
            "duration_s": info.duration,
            "gpu_seconds": gpu_s,
            "cold_start_s": cold,
            "whisper_model": self._model_name,
            "diarized": diarized,
        }
