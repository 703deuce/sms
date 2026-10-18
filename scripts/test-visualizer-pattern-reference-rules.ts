import assert from "node:assert/strict";
import { catalogMaterialNeedsSurfacePatternReference } from "../src/lib/visualizer/catalog-pattern-reference-rules";

assert.equal(
  catalogMaterialNeedsSurfacePatternReference({
    panelLine: "PIONEER_PLUS",
    materialSlug: "travertine",
  }),
  false,
  "Travertine is smooth Pioneer Plus — no Image 3",
);

assert.equal(
  catalogMaterialNeedsSurfacePatternReference({
    panelLine: "PIONEER_PLUS",
    materialSlug: "tundra-grey",
  }),
  true,
);

assert.equal(
  catalogMaterialNeedsSurfacePatternReference({
    panelLine: "BCI",
    materialSlug: "sierra-sand",
  }),
  false,
);

assert.equal(
  catalogMaterialNeedsSurfacePatternReference({
    panelLine: "MONTEREY",
    surfaceStyle: "tile_etch",
    materialSlug: "grey-stone-27-tile",
  }),
  true,
);

assert.equal(
  catalogMaterialNeedsSurfacePatternReference({
    panelLine: "MONTEREY",
    surfaceStyle: "smooth",
    materialSlug: "grey-stone-27-smooth",
  }),
  false,
);

console.log("test-visualizer-pattern-reference-rules: PASS");
