# Test support files (added Nov 17, 2026)
- Transovo simulator: build/ms_producer_editable/sim/ (transovo-sim.mjs and editor-host/). Copying build/ms_producer_editable to /workspace/ms_producer_editable puts it in place.
- Capture script: test_support/_capture/ -> copy to /workspace/motion_engines/_capture/ and run `npm ci` there.
- Test footage folders (/workspace/motion_tests/keith_murray_doc_2min and phil_blount_30s, about 5 GB): GitHub release `producer-kit-test-footage-20261117` in 703deuce/sms, files motion_tests.tar.part-aa, -ab, ... Restore with:
  cat motion_tests.tar.part-* | tar -xf - -C /workspace/motion_tests
  (excluded: keith_murray_doc_2min/assets/footage/interview_full.mp4, a 2 GB raw download no fixture or test references.)
  Check with: sha256sum -c motion_tests.tar.sha256 (after cat'ing the parts into motion_tests.tar), or skip the check.
