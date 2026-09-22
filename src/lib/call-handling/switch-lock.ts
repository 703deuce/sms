const chains = new Map<string, Promise<unknown>>();

/**
 * Serialize call-handling mutations per phone number (double-click / race protection).
 */
export async function withCallHandlingSwitchLock<T>(
  phoneNumberId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = phoneNumberId.trim();
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() => fn());
  chains.set(key, next);
  try {
    return await next;
  } finally {
    if (chains.get(key) === next) chains.delete(key);
  }
}
