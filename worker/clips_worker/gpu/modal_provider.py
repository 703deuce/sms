from __future__ import annotations

import logging
import os

from clips_worker.gpu.base import (
    FaceTrackReq,
    RenderReq,
    RenderRes,
    TranscribeReq,
    TranscribeRes,
    normalize_words,
)

log = logging.getLogger(__name__)

APP_NAME = os.environ.get("MODAL_APP_NAME", "transovo-gpu")


class ModalProvider:
    name = "modal"

    def _transcriber(self):
        import modal

        return modal.Cls.from_name(APP_NAME, "Transcriber")

    def transcribe(self, req: TranscribeReq) -> TranscribeRes:
        if not req.audio_url:
            raise ValueError("modal transcribe requires audio_url")
        T = self._transcriber()
        raw = T().transcribe.remote(req.audio_url, req.language, req.initial_prompt)
        words = normalize_words(raw.get("words") or [], offset_ms=req.offset_ms)
        return TranscribeRes(
            words=words,
            language=str(raw.get("language") or req.language or "en"),
            duration_s=float(raw.get("duration_s") or 0),
            gpu_seconds=float(raw.get("gpu_seconds") or 0),
            provider="modal",
        )

    def transcribe_many(self, reqs: list[TranscribeReq]) -> list[TranscribeRes]:
        if not reqs:
            return []
        T = self._transcriber()
        urls = [r.audio_url for r in reqs]
        langs = [r.language for r in reqs]
        prompts = [r.initial_prompt for r in reqs]
        raws = list(T().transcribe.map(urls, langs, prompts, order_outputs=True))
        out: list[TranscribeRes] = []
        for req, raw in zip(reqs, raws, strict=True):
            words = normalize_words(raw.get("words") or [], offset_ms=req.offset_ms)
            out.append(
                TranscribeRes(
                    words=words,
                    language=str(raw.get("language") or req.language or "en"),
                    duration_s=float(raw.get("duration_s") or 0),
                    gpu_seconds=float(raw.get("gpu_seconds") or 0),
                    provider="modal",
                )
            )
        return out

    def face_track(self, req: FaceTrackReq) -> dict:
        from clips_worker.gpu.modal_inflight import ModalInflight

        if not req.video_url:
            raise ValueError("modal face_track requires video_url")
        with ModalInflight():
            import modal

            Cls = modal.Cls.from_name(APP_NAME, "FaceTracker")
            return Cls().face_track.remote(req.video_url, {})

    def render_batch(self, reqs: list[RenderReq]) -> list[RenderRes]:
        from clips_worker.gpu.modal_inflight import ModalInflight

        if not reqs:
            return []
        items = [
            {
                "segment_url": r.segment_url,
                "filtergraph": r.filtergraph,
                "out_upload_url": r.out_upload_url,
                "encoder": r.encoder,
            }
            for r in reqs
        ]
        with ModalInflight():
            import modal

            Cls = modal.Cls.from_name(APP_NAME, "Renderer")
            raws = Cls().render_batch.remote(items)
        out: list[RenderRes] = []
        for raw in raws:
            out.append(
                RenderRes(
                    ok=bool(raw.get("ok")),
                    duration_ms=int(raw.get("duration_ms") or 0),
                    size_bytes=int(raw.get("size_bytes") or 0),
                    gpu_seconds=float(raw.get("gpu_seconds") or 0),
                    provider="modal",
                )
            )
        return out
