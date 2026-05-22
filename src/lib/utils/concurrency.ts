/**
 * Concurrency utilities — keep external API call counts bounded.
 */

export interface ConcurrentMapResult<R> {
  ok: boolean
  value?: R
  error?: unknown
}

/**
 * Run `fn` over `items` with at most `limit` calls in flight.
 *
 * Each result is settled independently — failures do NOT reject the whole
 * batch. Inspect `.ok` on each entry to handle per-item errors.
 *
 * Used for bulk PDF import to keep ≤ 3 Anthropic API calls in flight.
 */
export async function concurrentMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<ConcurrentMapResult<R>[]> {
  const out: ConcurrentMapResult<R>[] = new Array(items.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      try {
        const value = await fn(items[i], i)
        out[i] = { ok: true, value }
      } catch (error) {
        out[i] = { ok: false, error }
      }
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker(),
  )
  await Promise.all(workers)
  return out
}
