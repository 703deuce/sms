import "server-only";

type NavTimingSection =
  | "auth"
  | "workspace"
  | "shell"
  | "entitlements"
  | "call_handling"
  | "page"
  | "provider"
  | "total";

export type NavTimingReport = Partial<Record<NavTimingSection, number>>;

export function logNavTiming(sections: NavTimingReport): void {
  if (process.env.NAV_TIMING !== "1" && process.env.NODE_ENV === "production") {
    return;
  }
  const payload = Object.fromEntries(
    Object.entries(sections).map(([k, v]) => [k, Math.round(v)]),
  );
  console.info("NAV_TIMING_MS", payload);
}

export async function timedNavSection<T>(
  section: NavTimingSection,
  sections: NavTimingReport,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    sections[section] = (sections[section] ?? 0) + (performance.now() - start);
  }
}
