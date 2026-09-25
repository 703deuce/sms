/** Prisma + app product source for MCTB conversations. */
export function isMctbConversationProductSource(
  productSource: string | null | undefined,
): boolean {
  if (!productSource) return false;
  const v = productSource.toUpperCase();
  return v === "MCTB";
}
