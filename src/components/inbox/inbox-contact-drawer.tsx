"use client";

import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import type { Contact, Conversation } from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";
import { CheckCircle2, Mail, Phone, X } from "lucide-react";

export function InboxContactDrawer({
  open,
  onClose,
  contact,
  conversation,
}: {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  conversation?: Conversation;
}) {
  if (!open) return null;

  const initials = contact
    ? `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase() || "?"
    : (conversation?.contactName || "?").slice(0, 2).toUpperCase();

  const displayName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : conversation?.contactName || "Contact";

  const subscribed = contact?.status === "Subscribed";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/20"
        aria-label="Close contact details"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] max-w-[92vw] flex-col border-l border-[#e5e7eb] bg-white shadow-2xl"
        role="dialog"
        aria-label="Contact details"
      >
        <div className="flex items-center justify-between border-b border-[#f3f4f6] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Contact Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef2ff] text-[18px] font-bold text-[#6366f1]">
              {initials}
            </span>
            <p className="mt-3 text-[17px] font-bold text-[#111827]">{displayName}</p>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                subscribed
                  ? "bg-[#ecfdf5] text-[#059669]"
                  : "bg-[#fef2f2] text-[#dc2626]",
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {contact?.status || (subscribed ? "Subscribed" : "Unknown")}
            </span>
            {contact?.dateAdded ? (
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Added {new Date(contact.dateAdded).toLocaleDateString()}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-3 border-t border-[#f3f4f6] pt-5">
            <DetailRow
              icon={Phone}
              label="Mobile Number"
              value={formatPhone(contact?.phone || conversation?.phone || "—")}
            />
            <DetailRow icon={Mail} label="Email" value={contact?.email || "—"} />
            {contact?.consentSource ? (
              <DetailRow icon={Mail} label="Source" value={contact.consentSource} />
            ) : null}
          </div>

          <dl className="mt-6 space-y-4 border-t border-[#f3f4f6] pt-5 text-[13px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Lists
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {contact?.lists?.length ? (
                  contact.lists.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-[11px] font-medium text-[#374151]"
                    >
                      {l}
                    </span>
                  ))
                ) : (
                  <span className="text-[#6b7280]">None</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Opt-out
              </dt>
              <dd className="mt-1 font-medium text-[#111827]">
                {contact?.status === "Unsubscribed" || contact?.status === "Blocked"
                  ? "Yes"
                  : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Last message
              </dt>
              <dd className="mt-1 font-medium text-[#111827]">
                {contact?.lastMessaged
                  ? new Date(contact.lastMessaged).toLocaleString()
                  : conversation?.updatedAt
                    ? new Date(conversation.updatedAt).toLocaleString()
                    : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-[#f3f4f6] pt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Tags
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(conversation?.tags?.length ? conversation.tags : contact?.tags || []).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#6366f1]"
                >
                  {t}
                </span>
              ))}
              <button
                type="button"
                className="rounded-full border border-dashed border-[#d1d5db] px-2 py-0.5 text-[11px] text-[#6b7280]"
              >
                +
              </button>
            </div>
          </div>

          {contact?.customFields && Object.keys(contact.customFields).length > 0 ? (
            <div className="mt-6 border-t border-[#f3f4f6] pt-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Custom Fields
              </p>
              <dl className="space-y-2 text-[13px]">
                {Object.entries(contact.customFields).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-[#6b7280]">{key}</dt>
                    <dd className="font-medium text-[#111827]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {contact ? (
            <div className="mt-6 border-t border-[#f3f4f6] pt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Connected apps
              </p>
              <ConnectedRecordsPanel contactId={contact.id} compact />
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" />
      <div>
        <p className="text-[11px] font-medium text-[#9ca3af]">{label}</p>
        <p className="text-[13px] font-medium text-[#111827]">{value}</p>
      </div>
    </div>
  );
}
