export function normalizeDomain(input: string): string {
  return input.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}
