export function getTelnyxApiKey(): string {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) {
    throw new Error("TELNYX_API_KEY is not configured");
  }
  return key;
}

export function getTelnyxApiBaseUrl(): string {
  return (process.env.TELNYX_API_BASE_URL?.trim() || "https://api.telnyx.com/v2").replace(/\/$/, "");
}

export function assertTelnyxConfigured(): { apiKey: string } {
  return { apiKey: getTelnyxApiKey() };
}
