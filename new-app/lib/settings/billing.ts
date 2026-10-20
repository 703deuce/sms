export async function isWorkspaceCreditEnforced(_workspaceId: string): Promise<boolean> {
  return false;
}
export async function deductCreditsForSend(_workspaceId: string, _units: number, _reason: string): Promise<void> {}
