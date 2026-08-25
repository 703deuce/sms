const LETTER_TO_DIGIT: Record<string, string> = {
  A: "2",
  B: "2",
  C: "2",
  D: "3",
  E: "3",
  F: "3",
  G: "4",
  H: "4",
  I: "4",
  J: "5",
  K: "5",
  L: "5",
  M: "6",
  N: "6",
  O: "6",
  P: "7",
  Q: "7",
  R: "7",
  S: "7",
  T: "8",
  U: "8",
  V: "8",
  W: "9",
  X: "9",
  Y: "9",
  Z: "9",
};

/** Normalize to uppercase A–Z only. */
export function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Telephone keypad mapping (ABC=2 … WXYZ=9). */
export function wordToKeypadDigits(word: string): string {
  const normalized = normalizeWord(word);
  let out = "";
  for (const ch of normalized) {
    const digit = LETTER_TO_DIGIT[ch];
    if (digit) out += digit;
  }
  return out;
}

export function parsePhoneDigits(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits;
}

export function splitUsLocalNumber(digits10: string): {
  areaCode: string;
  subscriber: string;
} | null {
  if (digits10.length !== 10) return null;
  return {
    areaCode: digits10.slice(0, 3),
    subscriber: digits10.slice(3),
  };
}

export function formatUsPhone(digits10: string): string {
  if (digits10.length !== 10) return digits10;
  return `${digits10.slice(0, 3)}-${digits10.slice(3, 6)}-${digits10.slice(6)}`;
}
