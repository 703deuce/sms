# Screenwriting build tracker

Spec: Rick's `screenwriting` product doc (Oct 2026). **Local commits only** until W19 final push to master.

| Milestone | Status | Local SHA (when done) |
|-----------|--------|------------------------|
| W1 Skeleton & schema | done | `4da9e4582` |
| W2 Element behavior | done | `a6075f51f` |
| W3 Fountain + TXT | done | `b66b199ca` |
| W4 Pagination core | done | `0fe910cb7` |
| W5 FDX | done | `2cc57c549` |
| W6 Paged editor | done | `7e6f168b2` |
| W7 PDF export | done | `70832cef4` |
| W8 Writing aids | done | `2ad30a1e4` |
| W9 Persistence & versions | done | `9a2bb3d0e` |
| W10 Collab (last in spec order for collab) | done | `c5215823a` |
| W11 Comments & sharing | done | `c5215823a` (API with W10 scaffold) |
| W12 Templates | done | `2db289760` |
| W13 Revisions & locking | done | `ce0a2f8d4` |
| W14 Structure tools | done | `659652a9e` |
| W15 Breakdown & reports | done | `008f90a44` |
| W16 DOCX, Highland, PDF melt | partial | `b49fa56a4` (DOCX/Highland; melt job v16+) |
| W17 AI | partial | `c4e040394` (estimate/hash; UI jobs next) |
| W18 Table read | partial | `607358c58` (segmentation; Modal TTS next) |
| W19 Integrations & polish | partial | `0c0a601a0` (studio payload zod; themes/mobile next) |

Open decisions locked: OpenAI + Elevenlabs, Supabase Storage, credit stub, collab W10 last, fixtures via `scripts/sw-fetch-fixtures.sh`, offline thesaurus, mobile read+comment only.

**Backup branches on GitHub:** `screenwriting-wip`, `wip/near-live-streamer` (push after milestones; no deploy).
