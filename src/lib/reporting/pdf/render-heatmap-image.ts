import sharp from "sharp";
import type { HeatmapCell } from "@/lib/reporting/types";
import { rankLabel, svgDigitLabel } from "@/lib/reporting/pdf/svg-digits";

/**
 * Falcon-colored rank grid PNG (not a geo map) — presentation / email asset.
 * Rank numbers are drawn as SVG paths so they render without system fonts.
 */
export async function renderHeatmapGridPng(params: {
  gridSize: number;
  cells: HeatmapCell[];
  cellPx?: number;
}): Promise<Buffer> {
  const cellPx = params.cellPx ?? (params.gridSize >= 13 ? 36 : params.gridSize >= 9 ? 48 : 64);
  const pad = 24;
  const legendH = 40;
  const width = pad * 2 + params.gridSize * cellPx;
  const height = pad * 2 + params.gridSize * cellPx + legendH;

  const byKey = new Map(params.cells.map((c) => [`${c.row}:${c.col}`, c]));
  const tiles: string[] = [];
  for (let row = 0; row < params.gridSize; row++) {
    for (let col = 0; col < params.gridSize; col++) {
      const cell = byKey.get(`${row}:${col}`);
      const color = cell?.color ?? "#ef4444";
      const textColor = cell?.textColor ?? "#ffffff";
      const label = rankLabel(cell?.rank);
      const x = pad + col * cellPx;
      const y = pad + row * cellPx;
      const cx = x + (cellPx - 2) / 2;
      const cy = y + (cellPx - 2) / 2;
      const digitSize = label.length > 1 ? cellPx * 0.42 : cellPx * 0.5;
      tiles.push(`
        <rect x="${x}" y="${y}" width="${cellPx - 2}" height="${cellPx - 2}" rx="6" fill="${color}"/>
        ${svgDigitLabel({ text: label, cx, cy, size: digitSize, color: textColor })}`);
    }
  }

  const legendY = height - 18;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${tiles.join("\n")}
    <rect x="${pad}" y="${legendY - 14}" width="12" height="12" rx="2" fill="#0B7A29"/>
    <rect x="${pad + 80}" y="${legendY - 14}" width="12" height="12" rx="2" fill="#EAA92B"/>
    <rect x="${pad + 160}" y="${legendY - 14}" width="12" height="12" rx="2" fill="#ef4444"/>
    ${svgDigitLabel({ text: "1", cx: pad + 28, cy: legendY - 8, size: 11, color: "#3f3f46" })}
    ${svgDigitLabel({ text: "3", cx: pad + 44, cy: legendY - 8, size: 11, color: "#3f3f46" })}
    ${svgDigitLabel({ text: "8", cx: pad + 108, cy: legendY - 8, size: 11, color: "#3f3f46" })}
    ${svgDigitLabel({ text: "-", cx: pad + 188, cy: legendY - 8, size: 11, color: "#3f3f46" })}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
