"use client";

import React, { useCallback, useEffect, useState } from "react";
import ThreadView from "@/components/kimi/conversations/components/ThreadView";
import type { Conversation, Tag, Teammate } from "@/lib/inbox/conversation-types";
import { ConversationsComposer } from "@/components/inbox/conversations-composer";
import {
  InboxAiAssistPanel,
  InboxAiBanner,
  useInboxAiAssist,
} from "@/components/ai-replies/inbox-ai-assist-panel";

type Props = {
  convo: Conversation;
  tags: Tag[];
  teammates: Teammate[];
  onUpdate: (c: Conversation) => void;
  contactOpen: boolean;
  onToggleContact: () => void;
  onOpenTagsSettings: () => void;
  onDownloadTranscript: () => void;
  allowTagging?: boolean;
  allowAssign?: boolean;
  composerDisabled?: boolean;
  composerDisabledReason?: string;
  onBack?: () => void;
  phoneNumbers?: Array<{ id: string; number: string; label?: string }>;
};

export function ConversationsThreadArea({
  convo,
  tags,
  teammates,
  onUpdate,
  contactOpen,
  onToggleContact,
  onOpenTagsSettings,
  onDownloadTranscript,
  allowTagging = true,
  allowAssign = true,
  composerDisabled = false,
  composerDisabledReason,
  onBack,
  phoneNumbers = [],
}: Props) {
  const assist = useInboxAiAssist(convo.id);
  const [prefill, setPrefill] = useState("");

  useEffect(() => {
    setPrefill("");
  }, [convo.id]);

  const Composer = useCallback(
    ({
      onSend,
      onNote,
      disabled,
    }: {
      onSend: (t: string, mediaUrls?: string[]) => void;
      onNote: (t: string) => void;
      disabled?: boolean;
    }) => (
      <>
        {composerDisabledReason ? (
          <div style={{ padding: "8px 16px", fontSize: 12, color: "#b45309", background: "#fffbeb", borderTop: "1px solid #fde68a" }}>
            {composerDisabledReason}
          </div>
        ) : null}
        <ConversationsComposer
          onSend={onSend}
          onNote={onNote}
          disabled={disabled || composerDisabled}
          prefill={prefill}
          onPrefillApplied={() => setPrefill("")}
          teammates={teammates}
          phoneNumbers={phoneNumbers}
          defaultFromNumberId={phoneNumbers[0]?.id}
        />
      </>
    ),
    [prefill, composerDisabled, composerDisabledReason, teammates, phoneNumbers],
  );

  return (
    <div
      className="conversations-thread-area conversations-thread--mobile-full"
      style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        {assist.session?.status === "ai_active" ? (
          <div style={{ padding: "8px 16px 0", background: "#fff" }}>
            <InboxAiBanner session={assist.session} onTakeover={() => void assist.takeover()} />
          </div>
        ) : null}
        <ThreadView
          convo={convo}
          tags={allowTagging ? tags : []}
          teammates={teammates}
          onUpdate={onUpdate}
          contactOpen={contactOpen}
          onToggleContact={onToggleContact}
          onOpenTagsSettings={allowTagging ? onOpenTagsSettings : () => undefined}
          onDownloadTranscript={onDownloadTranscript}
          liveMode
          ComposerSlot={Composer}
          allowAssign={allowAssign}
          allowTag={allowTagging}
          composerDisabled={composerDisabled}
          onBack={onBack}
        />
      </div>
      <InboxAiAssistPanel
        conversationId={convo.id}
        assist={assist}
        onUseSuggestion={(text) => setPrefill(text)}
      />
    </div>
  );
}
