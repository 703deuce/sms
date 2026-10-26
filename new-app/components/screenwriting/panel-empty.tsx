export function PanelEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded border border-dashed p-3 text-muted-foreground">
      <p className="font-medium text-foreground/80">{title}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug">{hint}</p> : null}
    </div>
  )
}
