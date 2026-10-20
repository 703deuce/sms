/** New-app id helper (no Supabase dependency). */
export function createId(prefix?: string): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${id}` : id;
}
