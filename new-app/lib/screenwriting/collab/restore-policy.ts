export type CollabRestoreAction = 'block' | 'snapshot_then_apply' | 'allow'

export function restorePolicyWithLiveCollaborators(
  liveEditors: number,
  action: 'restore' | 'import',
): { action: CollabRestoreAction; message: string } {
  if (liveEditors <= 1) {
    return { action: 'allow', message: 'No other collaborators connected.' }
  }
  if (action === 'import') {
    return {
      action: 'block',
      message: 'Import blocked while others are editing. Ask collaborators to disconnect.',
    }
  }
  return {
    action: 'snapshot_then_apply',
    message: 'Will create a PRE_RESTORE snapshot, then restore.',
  }
}
