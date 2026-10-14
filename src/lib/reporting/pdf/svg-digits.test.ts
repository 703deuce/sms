import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { renderHeatmapGridPng } from "@/lib/reporting/pdf/render-heatmap-image";
import { rankLabel, svgDigitLabel } from "@/lib/reporting/pdf/svg-digits";

describe("svg digits for report PNGs", () => {
  it("formats rank labels without unicode dashes", () => {
    assert.equal(rankLabel(1), "1");
    assert.equal(rankLabel(20), "20");
    assert.equal(rankLabel(null), "-");
    assert.equal(rankLabel(21), "-");
  });

  it("renders bubble-style digits that are visibly inked (not blank)", async () => {
    const svg = Buffer.from(`<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="#0B7A29"/>
      ${svgDigitLabel({ text: "12", cx: 60, cy: 60, size: 36, color: "#ffffff" })}
    </svg>`);
    const png = await sharp(svg).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    // Count near-white pixels — path strokes must paint something.
    let bright = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i] > 200 && png.data[i + 1] > 200 && png.data[i + 2] > 200) bright += 1;
    }
    assert.ok(bright > 80, `expected inked digits, found ${bright} bright pixels`);
  });

  it("heatmap PNG includes inked digits for a 3x3 grid", async () => {
    const cells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        cells.push({
          label: `${row}-${col}`,
          row,
          col,
          rank: row * 3 + col + 1,
          color: "#0B7A29",
          textColor: "#ffffff",
        });
      }
    }
    const buf = await renderHeatmapGridPng({ gridSize: 3, cells, cellPx: 64 });
    const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) bright += 1;
    }
    assert.equal(info.channels, 4);
    assert.ok(bright > 200, `heatmap digits missing; bright pixels=${bright}`);
  });
});
