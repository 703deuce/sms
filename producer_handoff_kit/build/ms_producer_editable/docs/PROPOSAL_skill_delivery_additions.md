# Proposal (for Rick's approval): additions to the production skill and delivery contract

**Nothing here has been applied.** The skill at `/home/box/agent-data/workflows/motion-studio-production/`, its
`delivery-contract.md`, the live routine and the `703deuce/sms` branch were not modified. Every item below is *additive*. The current
upload flow (prepare → signed PUT → commit, master first as `kind:"video"`, clips `media`, stems `audio`, `project.json` and
`assets-manifest.json` as `project`, scene source zip as `source`) stays exactly as it is.

## A. What a production would additionally deliver
| addition | produced in | format | why |
|---|---|---|---|
| `editable-elements.json` per theme-aware scene | Stage 6 (scene build) | `transovo.editable-elements/1` (`docs/CONTRACT.md`) | the editor knows what is editable, and how |
| scene code reads props through `ms-props-core.js` | Stage 6 | `producer/runtime/*` copied into the scene as `ms/` | one runtime for preview and export |
| `theme.json` as `transovo.motion-theme/1` | Stage 2 (world design) | colours as tokens, fonts as `{faces:[fontId], weight}` | one project theme with scene/element overrides |
| fonts by content hash | Stage 2 | `fnt_<sha256[:32]>[.faceIndex]` + engine catalog record | reproducible, no preset library |
| `assembly-recipe.json` | Stage 7 (assembly) | `transovo.assembly/1` (whitelisted filters, `themeBindings`) | the master can be rebuilt without a shell script |
| `runtime-lock.json` | Stage 7 | `producer/lib/runtime-lock.mjs` output | pinned engines and seeds |
| shot spec + face track for render_editable Python shots | Stage 6 | e.g. `fixtures/phil/sh04` (`track.py` at production time) | framing/zoom edits without AI |
| project version v1 | after upload | `transovo.motion-project/1` via the new versions endpoint | revisions start from storage, not from a bot's disk |

## B. Proposed skill text (new subsection under Stage 6, "Make theme-aware scenes editable")
> For every scene whose look comes from the project theme (title cards, lower thirds, labels, data graphics):
> 1. Import `ms/ms-props-core.js` and build the scene from resolved props (`rt.P`). Keep tweens, camera and timing in the scene code; those are protected.
> 2. Write `editable-elements.json`: elements, properties (tier, type, ranges, `maxChars`/`maxLines`, `overflow`), tokens used,
>    derived tokens with their design values, contrast pairs with design baselines, safe area, allowed overlaps, protected list, aiEditable list.
> 3. Attach an adapter: `apply` (re-style without a rebuild where possible), `layout` (auto-fit/overflow, overlap and safe-area checks), `bounds` (screen rects for DOM/SVG, `projectBounds` for three.js, `getBounds` for Pixi).
> 4. Prove it: the scene rendered with default props must match the scene rendered the old way (SSIM ≥ 0.99), and `setProps` of a long title must auto-fit or be refused.
> Footage-only shots and complex 3D sequences may stay non-editable. They keep their clip and the editor shows them as `NOT_THEME_AWARE`.

## C. Proposed delivery-contract additions
1. New upload kinds `font`, `image`, `bundle` (IDs `fnt_`/`ast_`/`bnd_` + sha256[:32], content-addressed, deduplicated with
   `exists:true`). Until Transovo accepts them, the bundle files ride inside the existing `source` zip and the importer (`fixtures/*/import.mjs` pattern) publishes them.
2. New endpoints (see `docs/TRANSOVO_INTEGRATION.md`): project versions (write-once, 409), asset lookup by sha, font catalogs, scene
   preview session, preview-assets, job events/checkpoint, worker registration/usage.
3. Revision jobs: `mode: "deterministic_render"` with an edit patch goes to the producer worker (no AI). Free-text revision requests stay
   `creative_production` and go to the production skill as today.
4. `.mov` (ProRes 4444) alpha overlays: the editable pipeline stores them as `media` assets inside storage. The proposal is to let the
   whitelist accept `video/quicktime` for `kind:"media"` (the master stays MP4).

## D. Migration of existing productions
`fixtures/keith/import.mjs` and `fixtures/phil/import.mjs` show the pattern. The delivered clips/master/stems become v1 assets. Chosen
theme-aware scenes are parameterized (defaults = the delivered look, verified by SSIM). Everything else is stored unchanged and
marked non-editable. This is opt-in per film; nothing is forced on running jobs.
