"""Text-to-video assembly (T2V_ASSEMBLE).

TTS: canonical path is new-app scene voice + voice cache (`t2v_voice_clips`, key `t2v/voice/{hash}.mp3`).
Worker `voice_cache.get_or_synthesize_voice_clip` shares that store for assemble-time cache misses only.
"""
