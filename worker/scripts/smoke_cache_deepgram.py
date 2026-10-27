import os
import subprocess
import tempfile
from pathlib import Path

key = "ws/ws_1/uploads/upl_df6a7581c4c548b08d5bf866ebc4af18/source.mp4"
from clips_worker.storage import download_object

with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    p1, p2 = td / "one.mp4", td / "two.mp4"
    print("download 1...", flush=True)
    download_object(key, p1)
    print("download 2...", flush=True)
    download_object(key, p2)
    wav = td / "clip.wav"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(p1),
            "-t",
            "8",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(wav),
        ],
    )
    from clips_worker.gpu.base import TranscribeReq
    from clips_worker.transcribe_provider import transcribe_audio_request
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    req = TranscribeReq(audio_path=str(wav))
    res, meta = transcribe_audio_request(conn, req, "ws_1", "smoke-cache-deepgram")
    fields = meta.as_progress_fields()
    print("transcriptionEngine", fields.get("transcriptionEngine"), flush=True)
    print("word_count", len(res.words), flush=True)
