/** Re-enable screenwriting UI + routes: set FEATURE_SCREENWRITING=1 (Coolify) and redeploy web. */
export function isScreenwritingEnabled(): boolean {
  const v = (
    process.env.FEATURE_SCREENWRITING ??
    process.env.NEXT_PUBLIC_FEATURE_SCREENWRITING ??
    ''
  )
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'on' || v === 'yes'
}
