# Enable paid ElevenLabs music on master (do not push from this note)

Paid music generation is already on in the box-local Producer skill at `/home/box/agent-data/workflows/motion-studio-production/`. The repo on `703deuce/sms` master still contains a block in the helper and a few leftover sentences in the skill docs. Apply the edits below in a follow-up commit; do not overwrite whole copies of `SKILL.md` or `RULES_FROM_RICK.md` (those master files are missing later box-local rules such as Look QA on the composed film page). Patch in place. Do not deploy Modal or the web app as part of this change.

The helper is `producer_handoff_kit/skills/motion-studio-production/scripts/gen_music.py`. It reads `ELEVENLABS_API_KEY` from the environment, or from `--env-file` if passed. The Producer should call it with `--env-file /workspace/secrets/motion_production.env`. The $2 cap (`MUSIC_CAP = 2.0`, `$0.15` per generated minute) and the procedural fallback on missing key, over-budget plans, or failed generation stay as they are.

## 1. `scripts/gen_music.py`

Delete the environment-variable check (and the two comment lines immediately above it) that currently looks up `MOTION_STUDIO_ELEVENLABS_MUSIC_COMMERCIAL_OK` and raises if it is not `"1"`. After the change, the paid path should go straight from the missing-key check to the format / compose call:

```python
        if not key:raise MusicError("ELEVENLABS_API_KEY is not set")
        current="mp3_48000_192" if chosen=="auto" else chosen
```

Also accept an optional `export ` prefix when reading `--env-file`, and stop after the first match:

```python
    if not key and args.env_file and not args.reuse_only:
        for line in args.env_file.read_text().splitlines():
            s=line.strip()
            if s.startswith("export "):
                s=s[7:].strip()
            if s.startswith("ELEVENLABS_API_KEY="):
                key=s.partition("=")[2].strip().strip("'\"")
                break
```

Do not auto-load a default secrets path (the offline missing-key test wipes the environment but the secrets file still exists on disk). Keep `--env-file` explicit.

## 2. `SKILL.md`

In the **Money** bullet, keep the new $2 music cap sentence and drop the trailing clause that currently starts "never call music without…". Final Money bullet:

> Every paid call (TTS, ElevenLabs Music, generation, LLM) gets at most **2 attempts**, the second only after the first failure is understood. Write the planned calls and estimated cost in the log first. Stop and report if the estimate exceeds the job's credits, or about **US$5** when no budget is given. Log every paid call and put the total in the final message. Music is capped near US$2 within the same overall ~US$5 budget.

In the **Music** bullet, drop the last sentence that currently starts "Commercial…". End that bullet with:

> …procedural-score fallback if the key is missing, generation fails, or the plan is over budget. Customer-supplied music takes precedence; BYOF may need none. Paid music generation is on and runs automatically, like TTS.

## 3. `RULES_FROM_RICK.md`

In §5 item **ElevenLabs music (Nov 19)**, drop the last sentence that currently starts "**Check…**". End the item with:

> Honor customer-supplied music and quiet edits. Paid music generation is on and runs automatically, like TTS.

## 4. `film-pipeline.md` §6 item 2

- In the prompt-hygiene clause, write "no artist or song-title prompts".
- In the fallback sentence, use: "If the key is missing, the estimate is over budget, or generation fails twice, use the existing procedural synth for the entire bed and record why."
- Delete the sentence that tells the Producer to set `MOTION_STUDIO_ELEVENLABS_MUSIC_COMMERCIAL_OK=1`, and the clause that the helper refuses paid generation without that variable.
- Add `--env-file /workspace/secrets/motion_production.env` to the documented run command.

Keep §6 item 3 (mixer flags) as already committed.

## 5. `engines.md`

In the API-keys paragraph, use this fallback wording and nothing further:

> Free paths that need no key: edge-tts scratch voice, Wikimedia Commons, yt-dlp, synthesised SFX; procedural music is a fallback when ElevenLabs Music is unavailable or the estimated score exceeds the ~$2 music cap.

## 6. Other docs / comments

Search the kit for `MOTION_STUDIO_ELEVENLABS_MUSIC_COMMERCIAL_OK` and delete every remaining reference (code, comments, specs). Do not add the variable to any env file.

`craft/sound.md` and `test_gen_music.py` do not need this cleanup. After the helper edit, re-run `python3 test_gen_music.py` from the skill root (offline only; no paid calls). All four tests should still pass.
