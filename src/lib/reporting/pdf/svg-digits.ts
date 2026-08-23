/**
 * Font-independent SVG digit paths for report PNGs.
 * Sharp/librsvg often has no Arial/Helvetica on Linux workers, so <text> silently vanishes.
 */

/** Unit digit paths in a 10×14 box (viewBox 0 0 10 14), stroke-based. */
const DIGIT_PATHS: Record<string, string> = {
  "0": "M2.5 1.5 H7.5 V12.5 H2.5 Z",
  "1": "M5 1.5 V12.5 M3.5 3 H5",
  "2": "M2.5 3.5 Q2.5 1.5 5 1.5 Q7.5 1.5 7.5 3.5 Q7.5 5.5 2.5 12.5 H7.5",
  "3": "M2.5 1.5 H7.5 L4.5 6.5 Q7.5 6.5 7.5 9.5 Q7.5 12.5 5 12.5 Q2.5 12.5 2.5 10.5",
  "4": "M6.5 1.5 V12.5 M6.5 1.5 L2.5 8.5 H8",
  "5": "M7.5 1.5 H2.5 V6.5 H5.5 Q7.5 6.5 7.5 9 Q7.5 12.5 5 12.5 Q2.5 12.5 2.5 10.5",
  "6": "M7 2.5 Q5 1.5 3.5 3.5 V10.5 Q3.5 12.5 5.5 12.5 Q7.5 12.5 7.5 10.5 Q7.5 8.5 5.5 8.5 H3.5",
  "7": "M2.5 1.5 H7.5 L4 12.5",
  "8": "M5 1.5 Q7.5 1.5 7.5 4 Q7.5 6 5 7 Q2.5 6 2.5 4 Q2.5 1.5 5 1.5 M5 7 Q7.5 8 7.5 10.5 Q7.5 12.5 5 12.5 Q2.5 12.5 2.5 10.5 Q2.5 8 5 7",
  "9": "M3 11.5 Q5 12.5 6.5 10.5 V3.5 Q6.5 1.5 4.5 1.5 Q2.5 1.5 2.5 3.5 Q2.5 5.5 4.5 5.5 H6.5",
  "-": "M2.5 7 H7.5",
};

function escapeLabel(label: string): string {
  return label.replace(/[^0-9A-Za-z+\-]/g, "").slice(0, 4) || "-";
}

/**
 * Centered multi-digit label as stroked paths (no system fonts required).
 */
export function svgDigitLabel(params: {
  text: string;
  cx: number;
  cy: number;
  /** Target glyph height in px */
  size: number;
  color: string;
  strokeWidth?: number;
}): string {
  const chars = escapeLabel(params.text).split("");
  const unitW = 10;
  const unitH = 14;
  const scale = params.size / unitH;
  const gap = 1.2 * scale;
  const totalW = chars.length * unitW * scale + Math.max(0, chars.length - 1) * gap;
  const startX = params.cx - totalW / 2;
  const topY = params.cy - (unitH * scale) / 2;
  const sw = params.strokeWidth ?? Math.max(1.4, params.size * 0.12);

  return chars
    .map((ch, i) => {
      const d = DIGIT_PATHS[ch] ?? DIGIT_PATHS["-"];
      const x = startX + i * (unitW * scale + gap);
      return `<g transform="translate(${x.toFixed(2)} ${topY.toFixed(2)}) scale(${scale.toFixed(4)})">
        <path d="${d}" fill="none" stroke="${params.color}" stroke-width="${(sw / scale).toFixed(3)}"
          stroke-linecap="round" stroke-linejoin="round"/>
      </g>`;
    })
    .join("\n");
}

/** Rank label for bubbles/heatmap: "1"…"20" or "-". */
export function rankLabel(rank: number | null | undefined): string {
  if (rank == null || Number.isNaN(rank) || rank > 20) return "-";
  return String(Math.round(rank));
}
