export async function redirectIfTrialLockedFeature(
  _organizationId: string,
  _feature: string,
): Promise<void> {
  // Trial locks not enforced for reputation in Transovo SMS v1.
}
