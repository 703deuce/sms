export async function requireOrganizationPermission(
  _organizationId: string,
  _permission: string,
): Promise<void> {
  // Transovo SMS — workspace membership is enforced in requireBusinessAccess.
}

export async function requireRecentAuth(): Promise<void> {
  // Optional step-up auth not required for reputation in SMS v1.
}
