# Transovo Text-to-Video: reference code (drop into the 703deuce/sms repo)

Status legend: TESTED = run on the box; REAL = complete, not compiled against the repo; SKETCH = thin/incomplete, finish in the named milestone.

worker/clips_worker/t2v/assemble.py        TESTED  scene normalize (cover-fit, Ken Burns), xfade chain, VO concat, mux
worker/clips_worker/t2v/titles_ass.py      TESTED  title + lower-third ASS (burned via ffmpeg ass=)
worker/clips_worker/t2v/tts_alignment.py   TESTED  ElevenLabs char alignment -> {w,s,e,i,spk}, i = slot*10000+k
worker/clips_worker/t2v/job.py             SKETCH  T2V_ASSEMBLE handler (M3); register in job_types.py + main.py DISPATCH
worker/tests/test_t2v_lavfi.py             TESTED  5 tests, ~3.6 s, lavfi inputs only
worker/tests/bench_t2v_60s.py              TESTED  60 s 720p30, 12 scenes: 13.5 s wall
new-app/lib/t2v/types.ts                   REAL    T2vDraftV1
new-app/lib/t2v/defaults.ts                REAL    default draft, LLM->scenes, duration estimate
new-app/lib/server/ai/pexels.ts            REAL    no-op until PEXELS_API_KEY is set
new-app/lib/server/ai/elevenlabs-tts.ts    REAL    with-timestamps TTS, /v2/voices, /v1/voices/add
new-app/lib/server/t2v/script-llm.ts       REAL    reuses openAiJsonResponse
new-app/lib/server/t2v/stock-match.ts      REAL    Pixabay+Pexels scoring and dedupe
new-app/lib/server/t2v/stock-asset.ts      REAL    provider-agnostic StockAsset copy via getClipStorage().putBytes
new-app/lib/server/t2v/to-composition.ts   REAL    draft -> ScriptDocumentV1
new-app/lib/server/t2v/credits.ts          REAL    costs; add ClipAction values in entitlements.ts
new-app/lib/server/t2v/drafts.ts           REAL    create/save (409 revision) / enqueue
new-app/app/api/t2v/**                     MIXED   drafts, [id], script, storyboard, assemble REAL; media/voice/voices/templates/extract SKETCH (re-export lib/server/t2v/routes/*, still to write)
new-app/prisma/t2v-additive.prisma         REAL    append to schema.prisma; migration folder must sort after 20261028150000_*
patches/pixabay-storage-driver.diff        REAL    fixes the existing ensureStockAsset driver bug
