"use client";

import React, { useCallback, useEffect, useState } from "react";
import ThreadView from "@/components/kimi/conversations/components/ThreadView";
import type { Conversation, Tag, Teammate } from "@/components/kimi/conversations/mock-data";
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
}: Props) {
  const assist = useInboxAiAssist(convo.id);
  const [prefill, setPrefill] = useState("");

  useEffect(() => {
    setPrefill("");
  }, [convo.id]);

  const Composer = useCallback(
    ({ onSend, onNote }: { onSend: (t: string, mediaUrls?: string[]) => void; onNote: (t: string) => void }) => (
      <ConversationsComposer
        onSend={onSend}
        onNote={onNote}
        prefill={prefill}
        onPrefillApplied={() => setPrefill("")}
      />
    ),
    [prefill],
  );

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
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
