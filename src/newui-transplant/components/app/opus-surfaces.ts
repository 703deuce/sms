/**
 * Canonical Opus / New UI 2 surface classes — single source for MCTB presentation.
 * Do not mix appointment-era shadow-xs or legacy newui token hacks here.
 */
export const OPUS_CARD =
  'rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)]'

/** Section title inside an Opus card (Reviews requests, MCTB panels). */
export const OPUS_CARDTitle = 'text-base font-semibold tracking-tight text-foreground'

export const OPUS_TABLE_HEAD = 'border-b bg-muted/40'

export const OPUS_SEARCH_INPUT =
  'h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

/** Compact context strip (consent/sender links, metadata) — full newui2 card shell. */
export const OPUS_META_STRIP =
  'flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-[0_1px_2px_rgba(16,18,40,0.04)]'

/** Inset choice list inside a panel (settings rows). */
export const OPUS_INSET_LIST = 'divide-y rounded-lg border bg-card'

/** Subtle tinted block for grouped configuration (not a full card stack). */
export const OPUS_CONFIG_INSET =
  'rounded-xl border border-border/70 bg-muted/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'

/** System-managed / locked copy surfaces (compliance, platform-managed). */
export const OPUS_SYSTEM_LOCK_SURFACE =
  'rounded-lg border border-dashed border-muted-foreground/30 bg-muted/45 px-3.5 py-3'

/** Compact operational status anchor (recovery running, verification). */
export const OPUS_STATUS_ANCHOR =
  'flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-[0_1px_2px_rgba(16,18,40,0.04)]'
