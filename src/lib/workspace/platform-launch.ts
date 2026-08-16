/**
 * Numbers platform v1 — single customer surface (Personal + Smart Routing).
 * Business workspace, AI receptionist, and messaging nav stay in code but hidden until launch.
 */
export const NUMBERS_PLATFORM_ONLY = true;

export function isNumbersPlatformOnlyLaunch(): boolean {
  return NUMBERS_PLATFORM_ONLY;
}
