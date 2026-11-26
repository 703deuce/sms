# AgentLab core8 — 2026-11-25 (deployed ~6:45 PM ET)
Server 204.168.139.158, /opt/agent. Backup + ROLLBACK.md: /opt/agent/backups/2026-11-25-core8/ (copy: ROLLBACK_core8.md).
Working tree: /workspace/agentlab_fix/core8/ (mirrored to agentlab_fix/ root so deploy.sh won't revert).
Runner restarted, active. All tests cleaned up; nothing queued/running/waiting; no test pages left.

| # | Piece | Existed vs built | Check | Off switch | Cost |
|---|---|---|---|---|---|
| 1 | Deep research | built new | PASS: fanout 2 queries→10 unique sources, 2 fetched; coverage check rc1 when short, rc0 when met; judge sees ledger line | tools/flags/DEEP_RESEARCH_OFF | $0 |
| 2 | Ask user mid-job | built new | PASS live: run paused (waiting) → urgent push → `answer` → resumed, replied "blue", done | tools/flags/ASK_USER_OFF | ~$0.01 |
| 3 | Browser handoff | existed; added push + watchdog pause | PASS (simulated status): 1 urgent notify per handoff, flag clears | runner/state/HANDOFF_WATCH_OFF | $0 |
| 4 | File deliverables | libs existed; built doc-verify, added reportlab/pymupdf/pdfplumber | PASS: caught #DIV/0! after LibreOffice recalc, chart listed, docx expect OK, empty pptx slide caught | tools/flags/DOC_VERIFY_OFF | $0 |
| 5 | Images/PDF/video understanding | images/PDF existed (agent_view, look/watch-media); built video-digest | PASS: 4 keyframes + 2 subtitle lines; faster_whisper imports | tools/flags/VIDEO_DIGEST_OFF | $0 |
| 6 | Image gen/edit | existed (Gemini key, KIE key); added cap + off switch | PASS: 4K refused by cap; 1 1K image made | tools/flags/IMAGE_GEN_OFF, IMAGE_MAX_USD | $0.038 |
| 7 | Crash/restart resume | partial; built restart_resume | PASS (harness): 5 [Recovery] msgs with checkpoints, 6th → failure() | runner/state/RESTART_RESUME_OFF | $0 |
| 8 | Live previews | publish existed; built preview | PASS: live URL 200, screenshot, 0 errors; bad page JS error caught (rc1) | tools/flags/PREVIEW_OFF | $0 |

Total test spend about $0.05.

## Files
- runner/agentd.py: questions table + GET /questions, POST /questions/<id>/answer; 'waiting' status; questions_tick; handoff_tick; stuck exemption during handoff; restart_resume (5 free resumes from checkpoints).
- runner/goal_judge.py: coverage ledger line in facts.
- tools: ask-user, answer, runcli.py (cmd_ask/cmd_answer), agent-context (open questions shown to the front desk; the LLM decides whether Rick's message answers one), research-fanout, research-coverage, doc-verify, video-digest, preview, gen-image (cap).
- workspace/tools/bin/_image.py: cost_guard (image-gen and image-edit).
- skills: new lab-deep-research (gate_cmd: research-coverage check); updated lab-documents-spreadsheets, lab-slides-decks, lab-look-and-watch-media, lab-pages-dashboards, lab-image-video-gen, lab-sign-in-handoff.
- AGENTS.md: 2 lines (ask-user; deliverable tools), synced. build/Dockerfile: + reportlab pymupdf pdfplumber.

## Known limits
- Rick answers questions in his chat (the front desk records them) or via POST /questions/<id>/answer; the UI has no answer button yet.
- Handoff still moves the page to the shared Live screen desktop; job browsers are not streamed directly.
- Restart resume covers agent-server restarts; a conversation that disappeared (404) still fails as before.
- Image cost cap uses list-price estimates per size (1K $0.04, 2K $0.14, 4K $0.24).
