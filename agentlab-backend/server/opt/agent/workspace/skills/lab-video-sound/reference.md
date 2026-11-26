# Craft standards: loudness, dialogue, music, SFX (detail and sources)

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

## 1.12 Audio: loudness, dialogue, music, SFX

| Target | Integrated | True peak | Source |
|---|---|---|---|
| Broadcast, Europe (EBU R128) | −23.0 LUFS (±0.2 LU in post) | ≤ −1 dBTP | [EBU-R128] |
| US broadcast (ATSC A/85, CALM Act) | −24 LKFS | — | [HSM-9] |
| Streaming speech (AES TD1008) | **−18 LUFS** speech, music −16; keep above −20 | ≤ −1 dBTP | [AES] |
| Apple Podcasts | −16 LKFS ±1 | ≤ −1 dBFS | [APPLE-POD] |
| Spotify playback normalisation | −14 LUFS (default) | 1 dB headroom kept | [SPOT] |
| YouTube, TikTok, Instagram | **not published.** YouTube is widely measured near −14 but unconfirmed | — | — |

- **Must:** true peak ≤ **−1 dBTP**. Every published spec agrees.
- **Must:** an integrated level inside the house window (-14 LUFS +/-1). Social platforms publish nothing, so the house −14 LUFS is defensible. It sits louder than AES's speech recommendation and in line with Spotify-style −14.
- **Dialogue first.** Test the mix on a phone speaker; if you have to strain, duck deeper [JAP-DUCK].
- **Music under speech (ducking):**
  - A typical duck is **10–18 dB**; radio-spot practice puts music **15–20 dB** under the voice.
  - By music type: sparse **10–12 dB**, busy with drums **15–18 dB**, **music with singing ≥ 20 dB**, or avoid it under speech entirely [JAP-DUCK].
  - Ramps: in **200–500 ms**, out **600–1500 ms**. The music is already down when the first word lands [JAP-DUCK].
- **SFX** stay under the voice. That's the house rule (≤ +0 dB over the speech median, off the stressed syllable), and it agrees with the dialogue-first principle.
- **Sports and actuality natural sound.** NFL Films and ESPN prioritise authentic crowd and field sound, cleaned and timed to the current play [VARIETY-NFL].
