/**
 * E2fix: one export = ONE toast. Before, the "Starting export…" loading toast was turned into
 * "Rendering export…" (a loading toast never auto-dismisses) and the poll that saw READY / FAILED
 * raised a *new* toast — so the spinner toast stayed in the corner after the MP4 was ready.
 * Every transition now updates (or dismisses) the same toast id.
 */
export type ExportToastApi = {
  loading: (msg: string, opts?: { id?: string | number }) => string | number
  success: (msg: string, opts?: { id?: string | number }) => string | number
  error: (msg: string, opts?: { id?: string | number }) => string | number
  dismiss: (id?: string | number) => void
}

export type ExportToast = {
  start: () => void
  rendering: () => void
  ready: (msg?: string) => void
  failed: (msg: string) => void
  /** Dismiss a still-open loading toast (dialog closed / poll gave up). No-op when settled. */
  dismiss: () => void
  readonly id: string | number | null
}

export function createExportToast(t: ExportToastApi): ExportToast {
  let id: string | number | null = null
  let settled = true
  return {
    get id() {
      return id
    },
    start() {
      if (id != null && !settled) t.dismiss(id)
      id = t.loading('Starting export…')
      settled = false
    },
    rendering() {
      id = t.loading('Rendering export…', id != null ? { id } : undefined)
      settled = false
    },
    ready(msg = 'Export ready — download below') {
      if (settled && id == null) return
      t.success(msg, id != null ? { id } : undefined)
      settled = true
      id = null
    },
    failed(msg: string) {
      t.error(msg, id != null ? { id } : undefined)
      settled = true
      id = null
    },
    dismiss() {
      if (id != null && !settled) t.dismiss(id)
      settled = true
      id = null
    },
  }
}
