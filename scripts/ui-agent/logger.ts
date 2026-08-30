export function log(step: string, detail?: string): void {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[ui-agent] ${step}${suffix}`);
}

export function logError(step: string, detail: string): void {
  console.error(`[ui-agent] ${step} — ${detail}`);
}
