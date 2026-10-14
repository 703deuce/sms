export function cleanSecret(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function secretFingerprint(value: string | undefined | null): string {
  const v = cleanSecret(value);
  if (!v) return "missing";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
