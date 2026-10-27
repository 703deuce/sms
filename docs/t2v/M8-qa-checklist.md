# M8 QA prep (manual on prod, FEATURE_T2V=1)

## Pages / states (§3)
- [ ] P1 `/app/clips/video/new` — idea, script, URL tabs; Continue disabled when empty
- [ ] P2 step=2 — settings; Write script → script review
- [ ] P3a `?mode=script` — autosave, 409 toast
- [ ] P3b `?mode=storyboard` — match stock, build video
- [ ] `/app/clips/[id]/script` — words + scenes after build
- [ ] `/app/exports` — clip + composition export rows

## Videos (1–3 min each; owner)
- [ ] Idea 16:9, script 9:16, URL blog 60s, audio (when extract ships)

## Automated (CI)
- `npm test -- tests/t2v-* tests/stock-match.test.ts`
- `cd worker && python3 -m pytest tests/test_t2v_tts_alignment.py tests/test_t2v_elevenlabs_tts.py -q`

## Perf (owner on prod worker)
- [ ] 3-min 1080p build + export wall time note in PR
