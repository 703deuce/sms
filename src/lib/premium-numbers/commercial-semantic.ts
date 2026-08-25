/**
 * Commercial semantic value of decoded vanity words (objective, search-independent).
 * Configurable weights — not pricing.
 */
export const COMMERCIAL_SEMANTIC_WEIGHTS: Record<string, number> = {
  PLUMBER: 95,
  PLUMBING: 92,
  LAWYER: 95,
  LAWYERS: 93,
  ATTORNEY: 90,
  INJURED: 95,
  ROOFING: 90,
  ROOFERS: 88,
  ROOFER: 86,
  MOWER: 85,
  MOWERS: 83,
  PLUMB: 85,
  PLUMBERS: 84,
  ROOF: 80,
  ROOFS: 78,
  LAWN: 80,
  LAWNS: 78,
  PIPE: 75,
  PIPES: 73,
  DRAIN: 72,
  DRAINS: 70,
  GRASS: 70,
  HVAC: 68,
  HEATING: 72,
  COOLING: 72,
  HEAT: 65,
  COOL: 65,
  HOME: 55,
  FIX: 45,
  FIXER: 50,
  LEAK: 55,
  LEAKS: 52,
  WATER: 50,
  YARD: 48,
  MOW: 30,
  MOWING: 55,
  MOVE: 55,
  MOVING: 60,
  MOVERS: 62,
  JUNK: 58,
  HAUL: 55,
  TRASH: 52,
  DENTAL: 65,
  DENTIST: 75,
  AUTO: 50,
  CARS: 48,
  TIRE: 45,
  TIRES: 48,
  LEGAL: 70,
  LAW: 55,
  TRIAL: 60,
};

const DEFAULT_COMMERCIAL_SEMANTIC = 25;

/** Length-based floor when word is not in the commercial dictionary. */
function lengthFallback(word: string): number {
  const len = word.length;
  if (len >= 7) return 70;
  if (len === 6) return 65;
  if (len === 5) return 55;
  if (len === 4) return 45;
  if (len === 3) return 20;
  return 0;
}

export function commercialSemanticScoreForWord(word: string): number {
  const normalized = word.trim().toUpperCase();
  const configured = COMMERCIAL_SEMANTIC_WEIGHTS[normalized];
  if (configured !== undefined) return configured;
  return lengthFallback(normalized);
}

export function commercialSemanticScoreForWords(words: string[]): number {
  if (!words.length) return 0;
  let best = 0;
  for (const w of words) {
    best = Math.max(best, commercialSemanticScoreForWord(w));
  }
  return Math.min(100, best);
}
