export const REPORT_GENERATION_TIMEOUT_MS = 120_000;

/** Best-effort wall-clock limit for PDF/HTML report generation. */
export async function withReportGenerationTimeout<T>(
  fn: () => Promise<T>,
  ms = REPORT_GENERATION_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Report generation timed out after ${ms / 1000}s`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
