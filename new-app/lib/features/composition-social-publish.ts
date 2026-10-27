/** Client-safe mirror of server gate — default off until worker + OAuth ship. */
export function isCompositionSocialPublishEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_COMPOSITION_SOCIAL_PUBLISH === '1'
}
