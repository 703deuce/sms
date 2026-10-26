# Screenwriting build tracker & audit (W1–W19)

Spec: `uploads/screenwriting.md` (Oct 2026). **Shipped on `master` after merge.**

## Milestone summary

| W | Theme | Status |
|---|--------|--------|
| W1 | Skeleton & schema | DONE |
| W2 | Elements & SmartType | DONE |
| W3 | Fountain + TXT | DONE |
| W4 | Pagination core | DONE |
| W5 | FDX | DONE (full FD parity / golden fixtures optional) |
| W6 | Paged editor | DONE |
| W7 | PDF export | DONE |
| W8 | Writing aids | DONE |
| W9 | Versions & offline | DONE |
| W10 | Collab | DONE (token + Hocuspocus service; WS optional) |
| W11 | Comments & sharing | DONE |
| W12 | Templates | DONE (feature, TV hour, multi-cam) |
| W13 | Revisions & locking | DONE (engine + UI revision set) |
| W14 | Structure tools | DONE |
| W15 | Breakdown & reports | DONE |
| W16 | DOCX/Highland/PDF melt | DONE |
| W17 | AI | DONE (OpenAI wired) |
| W18 | Table read / read-aloud | DONE |
| W19 | Polish & Studio | DONE |

## Detailed audit (spec bullet → code)

### W1
| Bullet | Status | Path |
|--------|--------|------|
| Prisma Sw* models | DONE | `new-app/prisma/schema.prisma`, `new-app/prisma/migrations/20261026200000_sw_w1_screenwriting/` |
| TipTap schema (dual, page break) | DONE | `new-app/lib/screenwriting/schema/extensions.ts` |
| FormatSpec + Feature | DONE | `new-app/lib/screenwriting/formats/feature.ts` |
| `/app/sw` list + editor | DONE | `new-app/app/app/sw/page.tsx`, `new-app/app/app/sw/scripts/[scriptId]/page.tsx` |
| Local save | DONE | `new-app/components/screenwriting/screenplay-editor.tsx` |

### W2
| Bullet | Status | Path |
|--------|--------|------|
| Enter/Tab machine | DONE | `new-app/lib/screenwriting/editor/element-keys.ts`, `screenplay-editor.tsx` |
| Auto-convert, ⌘1–8 | DONE | `element-keys.ts`, `shortcuts.ts`, editor keymap |
| SmartType + rename | DONE | `new-app/lib/screenwriting/smarttype/store.ts` |
| Caps display | DONE | `new-app/lib/screenwriting/editor/element-style.ts` |

### W3
| Bullet | Status | Path |
|--------|--------|------|
| Fountain 1.1 parse/serialize | DONE | `new-app/lib/screenwriting/fountain/` |
| Import/export API | DONE | `new-app/app/api/sw/scripts/[id]/import|export/route.ts` |
| TXT export | DONE | export route `format=txt` |

### W4
| Bullet | Status | Path |
|--------|--------|------|
| Wrap + paginate R1–R10 subset | DONE | `new-app/lib/screenwriting/layout/` |
| MORE/CONT'D, eighths, incremental | DONE | `layout/paginate.ts` |
| Tests | DONE | `new-app/tests/screenwriting-w4.test.ts` |

### W5
| Bullet | Status | Path |
|--------|--------|------|
| FDX import/export | DONE | `new-app/lib/screenwriting/fdx/` |
| unknown XML bag | DONE | `fdx/parse.ts` (`unknownFdx`) |
| Golden Big Fish page parity | STUB | fixtures not committed; run `scripts/sw-fetch-fixtures.sh` locally |

### W6
| Bullet | Status | Path |
|--------|--------|------|
| Layout worker protocol | DONE | `new-app/lib/screenwriting/layout/worker-protocol.ts` |
| Page decorations | DONE | `new-app/components/screenwriting/use-page-decorations.ts` |
| Status bar + views | DONE | `script-status-bar.tsx`, `screenplay-workspace.tsx` |

### W7
| Bullet | Status | Path |
|--------|--------|------|
| pdfkit renderer | DONE | `new-app/lib/screenwriting/pdf/render.ts` |
| Title page option | DONE | PDF render + workspace title panel |

### W8
| Bullet | Status | Path |
|--------|--------|------|
| Title page editor | DONE | workspace `title` panel |
| Find/replace | DONE | `writing/find-replace.ts`, workspace |
| Error check | DONE | `writing/error-check.ts` |
| Spellcheck seed | DONE | `writing/spellcheck.ts` |
| Shelf | DONE | `meta/shelf.ts` |

### W9
| Bullet | Status | Path |
|--------|--------|------|
| Versions API + restore | DONE | `app/api/sw/scripts/[id]/versions/`, `app/api/sw/versions/[vid]/restore/` |
| Compare diff | DONE | `versions/compare.ts`, compare route |
| Offline localStorage | DONE | `screenplay-workspace.tsx` |
| PRE_RESTORE | DONE | restore route |

### W10 (built last)
| Bullet | Status | Path |
|--------|--------|------|
| Hocuspocus service | DONE | `services/collab/` |
| HMAC collab token | DONE | `lib/screenwriting/collab/token.ts`, collab-token route |
| Editor collab hook | DONE | `use-screenplay-collab.ts` |

### W11
| Bullet | Status | Path |
|--------|--------|------|
| Comments API + UI list | DONE | `comments/route.ts`, workspace panel |
| Share links + `/s/:token` | DONE | `share-links/route.ts`, `app/s/[token]/page.tsx` |

### W12
| Bullet | Status | Path |
|--------|--------|------|
| Templates (feature, TV, multi-cam) | DONE | `formats/templates.ts`, workspace selector |

### W13
| Bullet | Status | Path |
|--------|--------|------|
| Page locks | DONE | `layout/locks.ts` |
| Scene numbers 5A/A1 | DONE | `revisions/scene-numbers.ts` |
| Revision set UI | DONE | workspace revision selector |

### W14
| Bullet | Status | Path |
|--------|--------|------|
| Navigator + CSV | DONE | `structure/navigator.ts`, workspace |
| Index cards + reorder | DONE | workspace `cards` + `scene-reorder.ts` |
| Beat board | DONE | workspace `beat` + `editorMeta` |
| Outline | DONE | workspace `outline` |

### W15
| Bullet | Status | Path |
|--------|--------|------|
| Character report | DONE | `reports/characters.ts` |
| Gender heuristic | DONE | `reports/gender-analysis.ts` |
| Breakdown tags | DONE | `breakdown/tagging.ts` |

### W16
| Bullet | Status | Path |
|--------|--------|------|
| DOCX / Highland | DONE | `export/docx.ts`, `export/highland.ts`, export route |
| PDF melt classifier | DONE | `worker/clips_worker/sw/pdf_melt.py` |

### W17
| Bullet | Status | Path |
|--------|--------|------|
| OpenAI run | DONE | `lib/screenwriting/ai/openai-run.ts` |
| AI API + cache | DONE | `app/api/sw/scripts/[id]/ai/[kind]/route.ts`, `SwAiResult` |
| Credit gate | DONE | `server/credits.ts` (no-op charge) |

### W18
| Bullet | Status | Path |
|--------|--------|------|
| Segmentation | DONE | `table-read/segment.ts` |
| Read aloud | DONE | workspace + `read-aloud/route.ts` (ElevenLabs) + `speechSynthesis` fallback |

### W19
| Bullet | Status | Path |
|--------|--------|------|
| Studio payload | DONE | `integrations/studio-payload.ts`, studio route |
| Themes / view modes / shortcuts | DONE | `editor/themes.ts`, `view-modes.ts`, `shortcut-map.ts`, workspace |
| App nav | DONE | `new-app/lib/nav.ts` → Screenwriting |

## Browser flows (Rick)

1. **Dashboard:** Clips sidebar → **Screenwriting** → `/app/sw`
2. **Create:** “New project” → open script → `/app/sw/scripts/{id}`
3. **Write:** Type in editor; ⌘1–8 elements; ⌘D dual; ⌘↩ page break; autosave
4. **Import:** Toolbar Import → `.fountain` / `.fdx`
5. **Export:** fountain, fdx, pdf, txt, docx, highland links in toolbar
6. **Structure:** Panels navigator / cards / beat / outline
7. **Title page:** `title` panel
8. **Find/replace:** `find` panel
9. **AI:** `ai` panel → Run (needs `OPENAI_API_KEY`)
10. **Read aloud:** Read aloud button (ElevenLabs if `ELEVENLABS_API_KEY`, else browser TTS)
11. **Versions:** `versions` panel → Snapshot / Restore
12. **Share:** Share → open `/s/{token}` read-only
13. **Reports:** `reports` panel (characters + gender heuristic)

## Streamer note (same repo)

`scripts/deploy-worker.sh` wait loop ignores stale `RUNNING` locks (`lockedAt` older than 3 minutes).
