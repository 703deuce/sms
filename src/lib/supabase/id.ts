/** Cuid-like id generator for inserts (Prisma @default(cuid()) replacement). */
export function createId() {
  const rand = crypto.getRandomValues(new Uint8Array(12));
  return (
    "c" +
    Date.now().toString(36) +
    Array.from(rand, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16)
  );
}
