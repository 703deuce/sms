"use client";
import { ArrowLeft, Search, Users, Download, MoreVertical, SearchX, X, Send, CalendarClock, Mail, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { Segment, contacts as mockContacts, type Contact } from "../mock-data";
import { PieSlice } from "./SegmentsList";

function downloadCsv(rows: Contact[], filename: string) {
  const header = "First Name,Last Name,Phone,Email,State,Status";
  const body = rows
    .map((c) => [c.firstName, c.lastName, c.phone, c.email, c.state, c.status].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ContactDrawer({ contact, onClose, onMessage }: { contact: Contact; onClose: () => void; onMessage: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Contact ${contact.firstName} ${contact.lastName}`}
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border shadow-xl seg-fade flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">{contact.firstName} {contact.lastName}</h3>
          <button aria-label="Close contact details" onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center text-sm font-semibold">
              {contact.firstName[0]}{contact.lastName[0]}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 mt-1 ${
                contact.status === "Subscribed" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-muted text-muted-foreground ring-border"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${contact.status === "Subscribed" ? "bg-emerald-500" : "bg-slate-400"}`} />
                {contact.status}
              </span>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="tabular-nums text-foreground">{contact.phone}</span></p>
            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /><span className="text-foreground">{contact.email || "—"}</span></p>
            <p className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-foreground">{contact.state}{contact.age ? ` · ${contact.age}` : ""}</span></p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Appointments</p>
            {contact.nextAppointment ? (
              <p className="flex items-center gap-2 text-[13px] text-foreground"><CalendarClock className="h-4 w-4 text-primary" />Next: {contact.nextAppointment}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">No upcoming appointment.</p>
            )}
            {contact.lastAppointment && (
              <p className="text-xs text-muted-foreground mt-1.5">Last: {contact.lastAppointment}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Full contact profile lives at <span className="font-medium text-foreground">/contacts/{contact.id}</span> in the app shell.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border">
          <button onClick={onMessage} className="seg-btn-primary w-full h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]">
            <Send className="h-4 w-4" /> Send Message
          </button>
        </div>
      </aside>
    </div>
  );
}

function MessageComposer({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="seg-msg-title" className="relative seg-card rounded-xl border border-border bg-card w-full max-w-md p-5 seg-fade">
        {sent ? (
          <div className="text-center py-3">
            <span className="mx-auto mb-3 h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center">
              <Send className="h-5 w-5" />
            </span>
            <h3 className="text-[15px] font-semibold text-foreground">Message sent</h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              Your message to {contact.firstName} {contact.lastName} was sent. The conversation is available in Messages.
            </p>
            <button onClick={onClose} className="mt-4 h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium transition-colors">Done</button>
          </div>
        ) : (
          <>
            <h3 id="seg-msg-title" className="text-[15px] font-semibold text-foreground">
              Message {contact.firstName} {contact.lastName}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">To <span className="tabular-nums">{contact.phone}</span> · appointment-related message</p>
            <label htmlFor="seg-msg-body" className="block text-[13px] font-medium text-foreground mt-4">Message</label>
            <textarea
              id="seg-msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type your message…"
              className="seg-input mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground resize-none"
            />
            {contact.status !== "Subscribed" && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                This contact is unsubscribed from SMS. Messages may not be delivered until they re-subscribe.
              </p>
            )}
            <div className="flex justify-end gap-2.5 mt-4">
              <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={() => setSent(true)}
                disabled={!body.trim()}
                className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
              >
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SegmentContacts({
  segment,
  onBack,
  onEdit,
}: {
  segment: Segment;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [messageContact, setMessageContact] = useState<Contact | null>(null);
  const source = mockContacts;
  const filtered = source.filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const total = segment.contacts || source.length;

  const exportContacts = () => {
    const slug = segment.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "segment";
    downloadCsv(filtered, `${slug}-contacts.csv`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary mb-3 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Segments
      </button>
      <div className="flex items-center justify-between mb-1 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full border-2 border-primary flex items-center justify-center shrink-0"><PieSlice /></div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground truncate">{segment.name}</h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={exportContacts}
            disabled={filtered.length === 0}
            className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center gap-2 transition-colors shadow-sm disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={onEdit} className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-[0.98]">
            Edit Segment
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-12 flex items-center gap-1.5">
        <Users className="h-4 w-4" />
        <span className="tabular-nums font-medium text-foreground">{total.toLocaleString()}</span> matched contacts · updates dynamically
      </p>
      {total > source.length && (
        <div className="mb-4 ml-12 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-[12px] text-primary">
          Showing {source.length.toLocaleString()} of {total.toLocaleString()} matched contacts.
        </div>
      )}

      <div className="relative w-72 mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts"
          aria-label="Search contacts in segment"
          className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[150px_1fr_1fr_110px_70px_130px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <span>Phone</span><span>Name</span><span>Email</span><span>State</span><span>Age</span><span>Status</span><span></span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <SearchX className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-foreground">No contacts match “{q}”</h3>
                <p className="text-[13px] text-muted-foreground mt-1">Try a different search term.</p>
              </div>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="grid grid-cols-[150px_1fr_1fr_110px_70px_130px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center text-sm transition-colors hover:bg-muted/40">
                  <button onClick={() => setDetailContact(c)} className="font-medium text-primary tabular-nums text-left hover:underline">{c.phone}</button>
                  <button onClick={() => setDetailContact(c)} className="font-medium text-foreground truncate text-left hover:text-primary">{c.firstName} {c.lastName}</button>
                  <span className="text-muted-foreground truncate">{c.email || "—"}</span>
                  <span className="text-muted-foreground">{c.state}</span>
                  <span className="text-muted-foreground tabular-nums">{c.age ?? "—"}</span>
                  <span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
                      c.status === "Subscribed"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-muted text-muted-foreground ring-border"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${c.status === "Subscribed" ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {c.status}
                    </span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`More actions for ${c.firstName} ${c.lastName}`}
                      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                      onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {menuFor === c.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1">
                          <button onClick={() => { setMenuFor(null); setDetailContact(c); }} className="w-full px-3 py-2 text-sm text-left hover:bg-primary/5 hover:text-primary transition-colors">
                            View Contact
                          </button>
                          <button onClick={() => { setMenuFor(null); setMessageContact(c); }} className="w-full px-3 py-2 text-sm text-left hover:bg-primary/5 hover:text-primary transition-colors">
                            Send Message
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {detailContact && (
        <ContactDrawer
          contact={detailContact}
          onClose={() => setDetailContact(null)}
          onMessage={() => { setMessageContact(detailContact); setDetailContact(null); }}
        />
      )}
      {messageContact && (
        <MessageComposer contact={messageContact} onClose={() => setMessageContact(null)} />
      )}
    </div>
  );
}
