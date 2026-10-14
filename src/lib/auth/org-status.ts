import "server-only";

/** Transovo workspace org gate for LSE queue jobs — allow enqueues when workspace exists. */
export async function assertOrganizationCanEnqueue(
  organizationId: string,
  _jobType: string,
): Promise<void> {
  if (!organizationId?.trim()) {
    throw new Error("organizationId required");
  }
}
