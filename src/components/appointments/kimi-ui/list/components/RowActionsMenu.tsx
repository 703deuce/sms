import { useEffect, useRef, useState } from "react";

export function RowActionsMenu({
  name,
  status,
  pendingApproval,
  onAction,
}: {
  name: string;
  status: string;
  pendingApproval?: boolean;
  onAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = !["canceled", "completed", "no_show"].includes(status);

  return (
    <div className="tv-rowmenu" ref={ref}>
      <button
        type="button"
        className="tv-iconbtn"
        aria-label={`More actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>
      </button>
      {open && (
        <div className="tv-menu" role="menu">
          <button role="menuitem" className="tv-menuitem" onClick={() => { setOpen(false); onAction("open"); }}>
            Open appointment
          </button>
          <button role="menuitem" className="tv-menuitem" onClick={() => { setOpen(false); onAction("message"); }}>
            Message customer
          </button>
          {pendingApproval ? (
            <>
              <div className="tv-menudivider" />
              <button role="menuitem" className="tv-menuitem" onClick={() => { setOpen(false); onAction("approve"); }}>
                Approve booking
              </button>
              <button role="menuitem" className="tv-menuitem tv-menuitem--danger" onClick={() => { setOpen(false); onAction("decline"); }}>
                Decline booking
              </button>
            </>
          ) : null}
          {isActive && (
            <button role="menuitem" className="tv-menuitem" onClick={() => { setOpen(false); onAction("reschedule"); }}>
              Reschedule
            </button>
          )}
          {isActive && (
            <>
              <div className="tv-menudivider" />
              <button role="menuitem" className="tv-menuitem tv-menuitem--danger" onClick={() => { setOpen(false); onAction("cancel"); }}>
                Cancel appointment
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
