/** IDs created by AR/Microsoft scale tests — safe to treat as disposable when classifying cleanup. */
export function isSimMicrosoftConnectionId(id: string): boolean {
  return id.startsWith("sim-ms-conn-") || id.startsWith("sim-ms-renew-");
}
