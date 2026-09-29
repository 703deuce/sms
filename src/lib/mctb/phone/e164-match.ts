/** Loose E.164 equality (10-digit US vs +1). */
export function mctbSameE164(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (da === db) return true;
  if (da.length === 10 && db === `1${da}`) return true;
  if (db.length === 10 && da === `1${db}`) return true;
  return false;
}
