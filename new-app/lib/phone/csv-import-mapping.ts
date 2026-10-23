/** Auto-detect CSV column mapping from header names (shared by UI + tests). */
export function guessCsvColumnMapping(headers: string[]): {
  phone: string;
  name: string;
  company: string;
} {
  const guess = (names: string[]) =>
    headers.find((h) => names.some((n) => h.toLowerCase().includes(n))) || "";
  return {
    phone: guess(["phone", "mobile", "cell"]) || headers[0] || "",
    name: guess(["name", "full"]),
    company: guess(["company", "account"]),
  };
}
