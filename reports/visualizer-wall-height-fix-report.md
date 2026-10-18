# Visualizer wall-height injection fix

## 1. Root cause

**Field:** `showerWallHeight` (`FULL_CEILING` | `EIGHT_FT`) — existing UI/API/job field; data flow from wizard → `/api/visualizer/generate` → `startProjectGeneration` → `requestJson` → `run-generation-job.ts` → `buildVisualizerEditPrompt` was intact.

**Failure:** After prompt simplification (PR #693), `transformationPrompt()` no longer incorporated wall height. Coverage was only weakly appended at the end via `appendUserSelections` (or omitted), so Nano Banana often ignored partial vs full-height installation.

**Fix:** `buildCoverageInstruction()` maps `showerWallHeight` to `TO_CEILING` | `SURROUND_HEIGHT` and injects coverage as the **second** sentence (immediately after transformation). Material appearance stays on Image 2 only (no catalog name/veining prose).

## 2. Files changed

| File | Why |
|------|-----|
| `src/lib/visualizer/generation/prompt-builder.ts` | Coverage helpers, prompt formula, defaults `FULL_CEILING` |
| `scripts/test-visualizer-prompt-builder.ts` | Assertions for all transformation × height combos |

## 3. Final prompts (complete)

### Tub to shower — full height (448 chars)

Convert the bathtub in Image 1 into a walk-in shower in the same location. Apply the selected wall-panel material on the shower walls and extend the wall panels all the way to the ceiling. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Add a realistic shower base and enclosure. Photorealistic finished bathroom.

### Tub to shower — partial (469 chars)

Convert the bathtub in Image 1 into a walk-in shower in the same location. Apply the selected wall-panel material on the shower walls only up to the surround height, and keep painted wall above the panel line. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Add a realistic shower base and enclosure. Photorealistic finished bathroom.

### Tub to tub — full (457 chars)

Remodel the bathtub in Image 1 as a new bathtub installation in the same location. Keep the bathtub clearly visible. Apply the selected wall-panel material around the tub-surround walls and extend the wall panels all the way to the ceiling. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

### Tub to tub — partial (472 chars)

Remodel the bathtub in Image 1 as a new bathtub installation in the same location. Keep the bathtub clearly visible. Apply the selected wall-panel material around the tub-surround only up to the surround height, and keep painted wall above the panel line. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

### Shower to tub — full (429 chars)

Convert the existing shower in Image 1 into a bathtub installation in the same area. Apply the selected wall-panel material around the new tub-surround walls and extend the wall panels all the way to the ceiling. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

### Shower to tub — partial (440 chars)

Convert the existing shower in Image 1 into a bathtub installation in the same area. Apply the selected wall-panel material around the tub-surround only up to the surround height, and keep painted wall above the panel line. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

### Shower + tub deck wrap — full shower (516 chars)

Keep the separate shower and bathtub in Image 1 in their original locations. Extend the selected shower wall panels all the way to the ceiling. Also apply the same material only on the bathtub horizontal deck and front apron. Do not continue that material up the tub-side upper walls above the deck. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

### Shower + tub deck wrap — partial shower (550 chars)

Keep the separate shower and bathtub in Image 1 in their original locations. Stop the shower wall panels at the selected surround height, leaving the existing wall finish above. Also apply the same material only on the bathtub horizontal deck and front apron. Do not continue that material up the tub-side upper walls above the deck. Use Image 2 as the selected wall-panel material. Match its color and pattern closely. Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features. Photorealistic finished bathroom.

## 4. Configuration verification

- UI: `showerWallHeight` in new design wizard → generate API payload.
- `service.ts`: normalizes and persists on `requestJson`; inherits from parent job on refine.
- `run-generation-job.ts`: `normalizeShowerWallHeight(request.showerWallHeight)` → `buildVisualizerEditPrompt`.

## 5. Reference verification

- Prompt uses Image 2 for color/pattern; Image 3 only when `hasSurfacePatternReference`.
- `materialName` / `materialDescription` are not injected into provider prompts.

## 6. Tests

```bash
npx tsx scripts/test-visualizer-prompt-builder.ts
# test-visualizer-prompt-builder: PASS
```

Chargeable KIE image generation not run in this pass.
