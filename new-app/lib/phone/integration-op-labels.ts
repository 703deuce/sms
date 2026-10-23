const CRM_OP_LABELS: Record<string, string> = {
  import_contacts: "Import contacts",
  log_call: "Log calls",
  log_disposition: "Log dispositions",
  create_task: "Create tasks",
  sync_lists: "Sync lists",
};

export function labelCrmOperation(op: string): string {
  return CRM_OP_LABELS[op] ?? op.replace(/_/g, " ");
}

export function formatCrmOperations(ops: string[]): string {
  return ops.map(labelCrmOperation).join(" · ");
}
