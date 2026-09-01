import { Smile, Braces, Lock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessageEditor({
  label,
  value,
  onChange,
  editable = true,
  max = 918,
  withAttachment = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  max?: number;
  withAttachment?: boolean;
}) {
  return (
    <div className="msg-editor">
      <div className="msg-editor-head mb-1.5 flex items-center justify-between">
        <span className="msg-editor-label text-[13px] font-medium text-foreground">{label}</span>
        {editable ? (
          <span
            className={cn(
              "msg-editor-count text-[11.5px] font-medium tabular-nums",
              value.length > max * 0.9 ? "text-amber-600" : "text-muted-foreground/80",
            )}
          >
            {value.length}/{max}
          </span>
        ) : (
          <span className="msg-editor-count inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/60">
            <Lock size={10} />
            Not Editable
          </span>
        )}
      </div>
      <div
        className={cn(
          "msg-editor-box overflow-hidden rounded-lg border bg-card transition-all duration-150",
          editable
            ? "border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30"
            : "is-locked border-border/70 bg-muted/30",
        )}
      >
        <textarea
          className={cn(
            "msg-textarea block min-h-24 w-full resize-y bg-transparent px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground",
            !editable && "text-muted-foreground",
          )}
          value={value}
          readOnly={!editable}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div className="msg-editor-toolbar flex items-center justify-between border-t border-border/60 px-2 py-1.5">
          <div className="msg-editor-tools flex items-center gap-0.5">
            {withAttachment && editable && (
              <button
                type="button"
                className="msg-tool flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Attach media"
              >
                <Paperclip size={14} />
              </button>
            )}
            {editable && (
              <>
                <button
                  type="button"
                  className="msg-tool flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Insert emoji"
                >
                  <Smile size={14} />
                </button>
                <button
                  type="button"
                  className="msg-tool flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Insert merge tag"
                >
                  <Braces size={14} />
                </button>
              </>
            )}
          </div>
          {!editable && <Lock size={12} className="msg-editor-lock mr-1.5 text-muted-foreground/60" />}
        </div>
      </div>
    </div>
  );
}
