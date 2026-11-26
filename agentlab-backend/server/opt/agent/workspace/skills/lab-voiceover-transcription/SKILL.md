---
name: lab-voiceover-transcription
description: Voiceover (tts) and transcription with word timings (transcribe)
when_to_use: Use before making a voiceover (tts, ElevenLabs) or transcribing audio/video with word timestamps or speakers (transcribe, Deepgram).
---

# Voiceover and transcription

(Moved word for word from AGENTS.md lines 115-116. These are still your rules; they just load on demand.)

- `tts "text" -o out.mp3 [--voice id]` makes a voiceover (ElevenLabs flash, about $0.04 per 1,000 characters).
- `transcribe <file> -o out.json` transcribes with word timestamps and speakers (Deepgram nova-3, about $0.0043/min). Use it instead of local whisper when timing and speakers matter.
