import { Smile, Braces, Lock, Paperclip } from "lucide-react";

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
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {editable ? (
          <span className="text-[12px] text-muted-foreground">
            {value.length}/{max}
          </span>
        ) : (
          <span className="text-[12px] italic text-muted-foreground">Not Editable</span>
        )}
      </div>
      <div className="relative">
        <textarea
          className="msg-textarea"
          value={value}
          readOnly={!editable}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-muted-foreground">
            {withAttachment && <Paperclip size={16} className="cursor-pointer hover:text-foreground" />}
            <Smile size={16} className="cursor-pointer hover:text-foreground" />
            <Braces size={16} className="cursor-pointer hover:text-foreground" />
          </div>
          <Lock size={14} className="text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
