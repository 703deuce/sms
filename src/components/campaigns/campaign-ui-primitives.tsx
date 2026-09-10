/**
 * Campaign surfaces under Appointments — shared design-system primitives.
 * Preserves Kimi campaign layout; uses canonical Transovo UI components.
 */
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export { Button as CampaignButton };

export function CampaignLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <Label className={cn("text-foreground/90", className)} {...props} />;
}

export function CampaignInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={cn("h-9 text-[13px]", className)} {...props} />;
}

export function CampaignTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Textarea
      className={cn("min-h-[144px] resize-none text-[13.5px] leading-relaxed", className)}
      {...props}
    />
  );
}

export function CampaignChip({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary"
          aria-label="Remove"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function CampaignComposerBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampaignAudienceField({
  children,
  exclude,
  className,
  onClick,
}: {
  children: React.ReactNode;
  exclude?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-[10px] border bg-card px-3 py-1.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30",
        exclude ? "border-rose-200/80 bg-rose-50/30" : "border-border hover:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampaignDropdownPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampaignIconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-8 px-2 text-muted-foreground hover:text-foreground", className)}
      {...props}
    />
  );
}

export function CampaignPrimaryButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      className={cn("h-9 px-4 text-[13px] font-semibold shadow-sm", className)}
      {...props}
    />
  );
}

export function CampaignGhostButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-9 px-4 text-[13px] font-semibold", className)}
      {...props}
    />
  );
}

export function CampaignReviewCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampaignSegmentToggle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-[10px] bg-muted p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampaignSegmentOption({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex-1 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function CampaignWeekdayToggle({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex-1 rounded-md border px-0 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function CampaignModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

export function CampaignModalCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CampaignPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-screen flex-1 bg-muted/30 px-6 py-8 lg:px-10", className)}>
      {children}
    </div>
  );
}

export function CampaignFilterMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CampaignDropdownPanel
      className={cn("left-0 right-auto min-w-[200px] p-1.5", className)}
    >
      {children}
    </CampaignDropdownPanel>
  );
}

export function CampaignFilterMenuItem({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function CampaignActionMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CampaignDropdownPanel
      className={cn("left-auto right-0 min-w-[180px] p-1.5", className)}
    >
      {children}
    </CampaignDropdownPanel>
  );
}
