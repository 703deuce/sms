/**
 * Safe presentation-only component for UI Agent certification apply tests.
 * Not used in production routes — dev/certification only.
 */
export function SafePresentationDemo({ title = "UI Agent certification" }: { title?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Presentation-only surface for Visual UI Agent apply/validate certification.
      </p>
    </section>
  );
}
