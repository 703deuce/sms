# push_tree MANIFEST (Nov 21, 2026)

Layout = repo-relative paths under `703deuce/sms`. Copy the contents of this folder onto the repo root (suggested: on top of branch `rules/prerender-look-qa-20261119` or a fresh branch from master; see `producer_handoff_kit/handoff/producer_memory_and_routines.md` section 0 for why).

- Files: 119 (plus this MANIFEST), 1432 KB
- Excluded on purpose: anything from `/workspace/secrets`, `.env*`, `curl.cfg`, `job.json`, `job_token`, `lease_id`, `state/` dirs, node_modules, venvs, `__pycache__`, media, job outputs, caches, test files.
- 'Action' compares each staged file with the kit branch working tree and with `sms_master` HEAD `07e5b020` (SHA-256).
- `skills/motion-studio-production/scripts/render/` = the self-hosted scripts as installed on the box (`/workspace/motion_kit/modal/`); PR #1271 has them too (same bytes except `lib_env.sh`, which here adds `CHROMIUM_BIN`). `scripts/modal/` in the skill folder is the old Modal-era kit (kept because it is part of the live skill folder).

| Target repo path | Source path | Action vs repo | Bytes |
|---|---|---|---|
| `producer_handoff_kit/build/ms_producer_editable/HANDOFF.md` | `/workspace/ms_producer_editable/HANDOFF.md` | NEW (in neither) | 5846 |
| `producer_handoff_kit/build/ms_producer_editable/producer/assets/fonts/BigShouldersDisplay[wght].ttf` | `/workspace/ms_producer_editable/producer/assets/fonts/BigShouldersDisplay[wght].ttf` | NEW (in neither; font used by producer/assets/fonts) | 219532 |
| `producer_handoff_kit/engines/_capture/package-lock.json` | `/workspace/motion_engines/_capture/package-lock.json` | NEW (in neither) | 16008 |
| `producer_handoff_kit/engines/_capture/package.json` | `/workspace/motion_engines/_capture/package.json` | NEW (in neither) | 331 |
| `producer_handoff_kit/handoff/branch_only_versions/README.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/README.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 1947 |
| `producer_handoff_kit/handoff/branch_only_versions/RULES_FROM_RICK.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/RULES_FROM_RICK.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 18573 |
| `producer_handoff_kit/handoff/branch_only_versions/SKILL.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/SKILL.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 34914 |
| `producer_handoff_kit/handoff/branch_only_versions/craft/review.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/craft/review.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 7907 |
| `producer_handoff_kit/handoff/branch_only_versions/delivery.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/delivery.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 14072 |
| `producer_handoff_kit/handoff/branch_only_versions/engine-library.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/engine-library.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 45330 |
| `producer_handoff_kit/handoff/branch_only_versions/engines.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/engines.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 25310 |
| `producer_handoff_kit/handoff/branch_only_versions/film-pipeline.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/film-pipeline.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 12401 |
| `producer_handoff_kit/handoff/branch_only_versions/qa.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/qa.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 16777 |
| `producer_handoff_kit/handoff/branch_only_versions/reference-films.md` | `/workspace/sms_producer_kit/producer_handoff_kit/skills/motion-studio-production/reference-films.md  (branch rules/prerender-look-qa-20261119)` | NEW (in neither) | 11605 |
| `producer_handoff_kit/handoff/branch_vs_live_skill.diff` | `generated: diff -u kit branch vs live skill` | NEW (in neither) | 64502 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/creator_experience_phase1_spec.md` | `/workspace/handoff_for_chatgpt/creator_experience_phase1_spec.md` | NEW (in neither) | 48652 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/enable_music.md` | `/workspace/handoff_for_chatgpt/enable_music.md` | NEW (in neither) | 4694 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/music_step_spec.md` | `/workspace/handoff_for_chatgpt/music_step_spec.md` | NEW (in neither) | 30419 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/portable_400_fix.md` | `/workspace/handoff_for_chatgpt/portable_400_fix.md` | NEW (in neither) | 8915 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/pr1271_review.md` | `/workspace/handoff_for_chatgpt/pr1271_review.md` | NEW (in neither) | 12956 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/pr1271_review_round2.md` | `/workspace/handoff_for_chatgpt/pr1271_review_round2.md` | NEW (in neither) | 4881 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/pr1272_review.md` | `/workspace/handoff_for_chatgpt/pr1272_review.md` | NEW (in neither) | 19239 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/qa_black_frames_fix.md` | `/workspace/handoff_for_chatgpt/qa_black_frames_fix.md` | NEW (in neither) | 4387 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/render_speed_keith_murray.md` | `/workspace/handoff_for_chatgpt/render_speed_keith_murray.md` | NEW (in neither) | 18595 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/self_hosted_render_spec.md` | `/workspace/handoff_for_chatgpt/self_hosted_render_spec.md` | NEW (in neither) | 23056 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/sms_worker_build_fix.md` | `/workspace/handoff_for_chatgpt/sms_worker_build_fix.md` | NEW (in neither) | 2997 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/voice_clone_fix.md` | `/workspace/handoff_for_chatgpt/voice_clone_fix.md` | NEW (in neither) | 3157 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/voice_clone_fix_round2.md` | `/workspace/handoff_for_chatgpt/voice_clone_fix_round2.md` | NEW (in neither) | 2736 |
| `producer_handoff_kit/handoff/docs_from_chatgpt/voice_clone_fix_round3.md` | `/workspace/handoff_for_chatgpt/voice_clone_fix_round3.md` | NEW (in neither) | 2171 |
| `producer_handoff_kit/handoff/producer_memory_and_routines.md` | `/workspace/handoff_export/producer_memory_and_routines.md` | NEW (in neither) | 74154 |
| `producer_handoff_kit/handoff/proposed_merges/RULES_FROM_RICK.merged_proposal.md` | `generated: live RULES + branch-only Nov 19 rules (proposal)` | NEW (in neither) | 24143 |
| `producer_handoff_kit/handoff/rules_20261120_lil_jeff_notes.md` | `/workspace/pending_rules/rules_20261120_lil_jeff_notes.md` | NEW (in neither) | 938 |
| `producer_handoff_kit/patches/0001-fix-motion-studio-accept-render-first-live-documents.patch` | `/workspace/patches/0001-fix-motion-studio-accept-render-first-live-documents.patch` | NEW (in neither) | 6660 |
| `producer_handoff_kit/setup/motion_prod_env.requirements.txt` | `generated: importlib.metadata of /workspace/motion_prod_env (Nov 21)` | NEW (in neither) | 724 |
| `producer_handoff_kit/skills/motion-studio-production/README.md` | `/home/box/agent-data/workflows/motion-studio-production/README.md` | no-op on master; kit branch differs | 1506 |
| `producer_handoff_kit/skills/motion-studio-production/RULES_FROM_RICK.md` | `/home/box/agent-data/workflows/motion-studio-production/RULES_FROM_RICK.md` | CHANGED vs kit branch and master | 20019 |
| `producer_handoff_kit/skills/motion-studio-production/SKILL.md` | `/home/box/agent-data/workflows/motion-studio-production/SKILL.md` | no-op on master; kit branch differs | 30256 |
| `producer_handoff_kit/skills/motion-studio-production/brand-and-type.md` | `/home/box/agent-data/workflows/motion-studio-production/brand-and-type.md` | no-op (identical in kit branch and master) | 5475 |
| `producer_handoff_kit/skills/motion-studio-production/clip-production.md` | `/home/box/agent-data/workflows/motion-studio-production/clip-production.md` | no-op (identical in kit branch and master) | 24712 |
| `producer_handoff_kit/skills/motion-studio-production/craft-sources.md` | `/home/box/agent-data/workflows/motion-studio-production/craft-sources.md` | no-op (identical in kit branch and master) | 12543 |
| `producer_handoff_kit/skills/motion-studio-production/craft-standards.md` | `/home/box/agent-data/workflows/motion-studio-production/craft-standards.md` | no-op (identical in kit branch and master) | 48090 |
| `producer_handoff_kit/skills/motion-studio-production/craft/README.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/README.md` | no-op (identical in kit branch and master) | 5927 |
| `producer_handoff_kit/skills/motion-studio-production/craft/by-video-type.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/by-video-type.md` | no-op (identical in kit branch and master) | 6884 |
| `producer_handoff_kit/skills/motion-studio-production/craft/color-and-style.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/color-and-style.md` | no-op (identical in kit branch and master) | 5130 |
| `producer_handoff_kit/skills/motion-studio-production/craft/design-and-motion.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/design-and-motion.md` | no-op (identical in kit branch and master) | 11252 |
| `producer_handoff_kit/skills/motion-studio-production/craft/editing.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/editing.md` | no-op (identical in kit branch and master) | 10712 |
| `producer_handoff_kit/skills/motion-studio-production/craft/review.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/review.md` | no-op on master; kit branch differs | 7849 |
| `producer_handoff_kit/skills/motion-studio-production/craft/sound.md` | `/home/box/agent-data/workflows/motion-studio-production/craft/sound.md` | no-op on master; kit branch differs | 7311 |
| `producer_handoff_kit/skills/motion-studio-production/delivery-contract.md` | `/home/box/agent-data/workflows/motion-studio-production/delivery-contract.md` | no-op (identical in kit branch and master) | 29270 |
| `producer_handoff_kit/skills/motion-studio-production/delivery.md` | `/home/box/agent-data/workflows/motion-studio-production/delivery.md` | no-op on master; kit branch differs | 11031 |
| `producer_handoff_kit/skills/motion-studio-production/engine-library.md` | `/home/box/agent-data/workflows/motion-studio-production/engine-library.md` | no-op on master; kit branch differs | 45339 |
| `producer_handoff_kit/skills/motion-studio-production/engines.md` | `/home/box/agent-data/workflows/motion-studio-production/engines.md` | no-op on master; kit branch differs | 24824 |
| `producer_handoff_kit/skills/motion-studio-production/example_music_cues.json` | `/home/box/agent-data/workflows/motion-studio-production/example_music_cues.json` | no-op on master; kit branch absent | 530 |
| `producer_handoff_kit/skills/motion-studio-production/film-pipeline.md` | `/home/box/agent-data/workflows/motion-studio-production/film-pipeline.md` | CHANGED vs kit branch and master | 15228 |
| `producer_handoff_kit/skills/motion-studio-production/qa.md` | `/home/box/agent-data/workflows/motion-studio-production/qa.md` | no-op on master; kit branch differs | 16157 |
| `producer_handoff_kit/skills/motion-studio-production/reference-films.md` | `/home/box/agent-data/workflows/motion-studio-production/reference-films.md` | no-op on master; kit branch differs | 11549 |
| `producer_handoff_kit/skills/motion-studio-production/retention-psychology.md` | `/home/box/agent-data/workflows/motion-studio-production/retention-psychology.md` | no-op (identical in kit branch and master) | 46976 |
| `producer_handoff_kit/skills/motion-studio-production/retention-sources.md` | `/home/box/agent-data/workflows/motion-studio-production/retention-sources.md` | no-op (identical in kit branch and master) | 23703 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/README.md` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/README.md` | no-op (identical in kit branch and master) | 2659 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/contract/README.md` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/contract/README.md` | no-op (identical in kit branch and master) | 691 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/contract/ts-ext-loader.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/contract/ts-ext-loader.mjs` | no-op (identical in kit branch and master) | 477 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/deliver-editable.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/deliver-editable.mjs` | no-op (identical in kit branch and master) | 10479 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/deliver-master.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/deliver-master.mjs` | no-op (identical in kit branch and master) | 3804 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/launch.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/launch.sh` | no-op (identical in kit branch and master) | 2409 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/lib.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/lib.mjs` | no-op (identical in kit branch and master) | 8746 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/manifest.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/manifest.mjs` | no-op (identical in kit branch and master) | 4623 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/repack-live.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/repack-live.mjs` | no-op (identical in kit branch and master) | 10056 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/resume-all.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/resume-all.sh` | no-op (identical in kit branch and master) | 745 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/start-watchdog.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/start-watchdog.sh` | no-op (identical in kit branch and master) | 674 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/test/make-test-job.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/test/make-test-job.sh` | no-op (identical in kit branch and master) | 740 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/test/mock-server.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/test/mock-server.mjs` | no-op (identical in kit branch and master) | 9978 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/test/run-tests.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/test/run-tests.sh` | no-op (identical in kit branch and master) | 5861 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/test/verify-repack.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/test/verify-repack.mjs` | no-op (identical in kit branch and master) | 1887 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/bg_delivery/watchdog.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/bg_delivery/watchdog.sh` | no-op (identical in kit branch and master) | 890 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/gen_music.py` | `/home/box/agent-data/workflows/motion-studio-production/scripts/gen_music.py` | no-op on master; kit branch absent | 13534 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/README.md` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/README.md` | NEW on master (already in kit branch) | 8624 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/check_page.mjs` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/check_page.mjs` | NEW on master (already in kit branch) | 4958 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/lib_env.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/lib_env.sh` | NEW on master (already in kit branch) | 1897 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/make_bundle.py` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/make_bundle.py` | NEW on master (already in kit branch) | 20613 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/patches/publish_editable_remap_live_project.patch` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/patches/publish_editable_remap_live_project.patch` | NEW on master (already in kit branch) | 1132 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/render_status.py` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/render_status.py` | NEW on master (already in kit branch) | 1060 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/reuse.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/reuse.sh` | NEW on master (already in kit branch) | 675 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/reuse_assets.py` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/reuse_assets.py` | NEW on master (already in kit branch) | 2704 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/setup.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/setup.sh` | NEW on master (already in kit branch) | 983 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/status.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/status.sh` | NEW on master (already in kit branch) | 598 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/modal/submit.sh` | `/home/box/agent-data/workflows/motion-studio-production/scripts/modal/submit.sh` | NEW on master (already in kit branch) | 4881 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/qa_report.py` | `/home/box/agent-data/workflows/motion-studio-production/scripts/qa_report.py` | no-op (identical in kit branch and master) | 7935 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/.modal_disabled` | `/workspace/motion_kit/modal/.modal_disabled` | NEW (in neither) | 0 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/INSTALLED_SELFHOST.txt` | `/workspace/motion_kit/modal/INSTALLED_SELFHOST.txt` | NEW (in neither) | 314 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/README.md` | `/workspace/motion_kit/modal/README.selfhosted.md` | NEW (in neither) | 3145 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/build_from_job.py` | `/workspace/motion_kit/modal/build_from_job.py` | NEW (in neither) | 8748 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/check_page.mjs` | `/workspace/motion_kit/modal/check_page.mjs` | NEW (in neither) | 4347 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/lib_env.sh` | `/workspace/motion_kit/modal/lib_env.sh` | NEW (in neither) | 1469 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/make_bundle.py` | `/workspace/motion_kit/modal/make_bundle.py` | NEW (in neither) | 8435 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/modal_submit.sh` | `/workspace/motion_kit/modal/modal_submit.sh` | NEW (in neither) | 2209 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/render_status.py` | `/workspace/motion_kit/modal/render_status.py` | NEW (in neither) | 918 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/reuse.sh` | `/workspace/motion_kit/modal/reuse.sh` | NEW (in neither) | 282 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/reuse_assets.py` | `/workspace/motion_kit/modal/reuse_assets.py` | NEW (in neither) | 3609 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/setup.sh` | `/workspace/motion_kit/modal/setup.sh` | NEW (in neither) | 809 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/status.sh` | `/workspace/motion_kit/modal/status.sh` | NEW (in neither) | 477 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/submit.py` | `/workspace/motion_kit/modal/submit.py` | NEW (in neither) | 11328 |
| `producer_handoff_kit/skills/motion-studio-production/scripts/render/submit.sh` | `/workspace/motion_kit/modal/submit.sh` | NEW (in neither) | 250 |
| `producer_handoff_kit/skills/motion-studio-production/test_gen_music.py` | `/home/box/agent-data/workflows/motion-studio-production/test_gen_music.py` | no-op on master; kit branch absent | 2986 |
| `producer_handoff_kit/templates/ENGINE_STATUS.md` | `/workspace/motion_jobs/ENGINE_STATUS.md` | CHANGED vs kit branch; new on master | 19286 |
| `producer_handoff_kit/templates/STYLE_LEDGER.md` | `/workspace/motion_jobs/STYLE_LEDGER.md` | CHANGED vs kit branch; new on master | 26416 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/assets_footage_sources.txt` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/assets/footage/sources.txt` | NEW (in neither) | 335 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/audio_build_audio.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/audio/build_audio.py` | NEW (in neither) | 4807 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/audio_music_cues.json` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/audio/music_cues.json` | NEW (in neither) | 605 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/deliver_modal_submit.json` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/deliver_modal/submit.json` | NEW (in neither) | 367 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/editable_build_spec.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/editable/build_spec.py` | NEW (in neither) | 6506 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/film_build_clips.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/film/build_clips.py` | NEW (in neither) | 1890 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/log_job.md` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/log/job.md` | NEW (in neither) | 2927 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/qa_mk_sheets.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/qa/mk_sheets.py` | NEW (in neither) | 654 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/qa_prerender_blackcheck.txt` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/qa/prerender/blackcheck.txt` | NEW (in neither) | 2278 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/qa_stills.mjs` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/qa/stills.mjs` | NEW (in neither) | 2020 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/research_facts.md` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/research/facts.md` | NEW (in neither) | 1915 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/research_tr.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/research/tr.py` | NEW (in neither) | 443 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/research_tr2.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/research/tr2.py` | NEW (in neither) | 492 |
| `producer_handoff_kit/worked_examples/msaj_6d1ab72d_diddy_rayj_selfhosted/research_trw.py` | `/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/research/trw.py` | NEW (in neither) | 566 |

## Secret scan (Nov 21, 2026)
Patterns scanned over every file in `push_tree/` and the main handoff file: `sk_...`, `xi-api-key`, `Bearer <20+ chars>`, `api_key|secret|password|token = <16+ chars>`, `-----BEGIN`, JWT `eyJ...`, `AKIA...`, `ghp_...`, signed-URL query strings (`signature`, `X-Amz-`, `token=`, `sig=`), and any 32+ char hex/base64 assignment. Also checked for filenames `.env*`, `curl.cfg`, `job_token`, `lease_id`, `job.json`, `*.pem`, `*.key`: none present.
Result: **no secret values found.** Remaining hits are benign: the header NAME `xi-api-key` and `$ELEVENLABS_API_KEY` references (gen_music.py, specs), a localhost test `sig=` in `bg_delivery/test/mock-server.mjs`, filesystem paths, and public npm `integrity` hashes in `engines/_capture/package-lock.json`.
Redactions: the customer's cloned ElevenLabs voice id in `worked_examples/.../log_job.md` was replaced with `<customer_cloned_voice_id>` (customer data, not a credential). Nothing was read from `/workspace/secrets`.
- producer_handoff_kit/routine/transovo-motion-studio-production.LIVE.md <- live routine saved prompt (Nov 21)
