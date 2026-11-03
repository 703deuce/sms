/** Layout revamp §4 — shared editor chrome (design tokens / Tailwind only). */
export const editorToolbarRow =
  'flex h-11 min-h-11 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2'

export const editorToolbarGroup = 'flex items-center gap-2'

export const editorToolbarDivider = 'mx-1 h-5 w-px shrink-0 bg-border'

export const editorIconBtn =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'

export const editorIconBtnActive = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'

export const editorToolbarTextBtn =
  'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'

export const editorMenuSection =
  'px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'

export const editorMenuItem =
  'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40'

export const editorPreviewStrip =
  'flex min-h-11 items-center gap-4 border-t border-border bg-background/95 px-4 py-2'

export const editorPreviewStripSide = 'flex min-w-0 flex-1 items-center gap-2'

export const editorPreviewStripCenter = 'flex shrink-0 items-center justify-center gap-2'
