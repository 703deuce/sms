/** Run async work over items with a fixed worker pool (preserves result order). */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Math.min(Math.max(1, limit), items.length)

  async function worker(): Promise<void> {
    while (true) {
      const i = next++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}
