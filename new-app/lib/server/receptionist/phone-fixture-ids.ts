/** Demo fixtures from `lib/agent.ts` / `lib/data.ts` — never persist to production DB. */
export function isDemoFixturePhoneId(id: string | undefined | null): boolean {
  const v = id?.trim();
  if (!v) return false;
  return /^n\d+$/i.test(v);
}
