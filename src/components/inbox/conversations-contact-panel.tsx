"use client";

import { useEffect, useState } from "react";
import type { Contact, Conversation as ApiConversation } from "@/lib/types";
import type { Conversation } from "@/lib/inbox/conversation-types";
import { InboxContactDrawer } from "@/components/inbox/inbox-contact-drawer";
import { fetchContactById } from "@/lib/inbox/kimi-inbox-adapter";

type Props = {
  convo: Conversation;
  apiConvo?: ApiConversation | null;
  onClose: () => void;
};

export function ConversationsContactPanel({ convo, apiConvo = null, onClose }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (!convo.contactId) {
      setContact(null);
      return;
    }
    let cancelled = false;
    void fetchContactById(convo.contactId)
      .then((data) => {
        if (!cancelled) setContact(data);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [convo.contactId]);

  const apiConversation: ApiConversation | undefined =
    apiConvo ||
    (contact
      ? {
          id: convo.id,
          contactId: contact.id,
          contactName: convo.name,
          phone: contact.phone || convo.phone,
          lastMessage: convo.preview,
          assignedTo: null,
          status: "Open",
          tags: convo.tags,
          updatedAt: new Date().toISOString(),
          unread: !!convo.unread,
          messages: [],
        }
      : undefined);

  return (
    <InboxContactDrawer
      open
      onClose={onClose}
      contact={contact ?? undefined}
      conversation={apiConversation}
    />
  );
}
