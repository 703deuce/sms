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
    <div className="msg-editor">
      <div className="msg-editor-head">
        <span className="msg-editor-label">{label}</span>
        {editable ? (
          <span className="msg-editor-count">
            {value.length}/{max}
          </span>
        ) : (
          <span className="msg-editor-count italic">Not Editable</span>
        )}
      </div>
      <div className={`msg-editor-box ${editable ? "" : "is-locked"}`}>
        <textarea
          className="msg-textarea"
          value={value}
          readOnly={!editable}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div className="msg-editor-toolbar">
          <div className="msg-editor-tools">
            {withAttachment && (
              <button type="button" className="msg-tool" aria-label="Attach media">
                <Paperclip size={15} />
              </button>
            )}
            <button type="button" className="msg-tool" aria-label="Insert emoji">
              <Smile size={15} />
            </button>
            <button type="button" className="msg-tool" aria-label="Insert merge tag">
              <Braces size={15} />
            </button>
          </div>
          <Lock size={13} className="msg-editor-lock" />
        </div>
      </div>
    </div>
  );
}
