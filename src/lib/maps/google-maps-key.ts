export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
}

export function getGoogleMapsApiKeySource(): string {
  return getGoogleMapsApiKey() ? "env" : "none";
}

export function apiKeySuffix(key: string | null): string {
  if (!key || key.length < 4) return "—";
  return key.slice(-4);
}
