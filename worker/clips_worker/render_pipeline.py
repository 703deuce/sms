"""Export render cache / reuse version — keep in sync with new-app CLIP_RENDER_PIPELINE_REV."""

from clips_worker.build_info import clips_worker_git_sha_short

CLIP_AUDIO_RENDER_REV = "au33-v1"
RENDER_PIPELINE_VERSION = f"t48-{CLIP_AUDIO_RENDER_REV}-{clips_worker_git_sha_short()}"
