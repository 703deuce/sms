"use client";

import React, { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import ThreadView from "@/components/kimi/conversations/components/ThreadView";
import type { Conversation, Tag, Teammate } from "@/lib/inbox/conversation-types";
import { ConversationsComposer } from "@/components/inbox/conversations-composer";
import {
  InboxAiAssistPanel,
  InboxAiBanner,
  useInboxAiAssist,
} from "@/components/ai-replies/inbox-ai-assist-panel";
import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";

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
  composeFromRef?: MutableRefObject<string | undefined>;
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
  composeFromRef,
}: Props) {
  const assist = useInboxAiAssist(convo.id);
  const [prefill, setPrefill] = useState("");
  const [viewers, setViewers] = useState<Array<{ userId: string; userName: string }>>([]);

  const defaultFromNumberId = useMemo(() => {
    if (convo.fromE164 && phoneNumbers.length) {
      const target = normalizePhoneE164(convo.fromE164);
      const match = phoneNumbers.find((n) => normalizePhoneE164(n.number) === target);
      if (match) return match.id;
    }
    return phoneNumbers[0]?.id || "";
  }, [convo.fromE164, convo.id, phoneNumbers]);

  useEffect(() => {
    setPrefill("");
  }, [convo.id]);

  useEffect(() => {
    let cancelled = false;
    const heartbeat = () => {
      void fetch(`/api/inbox/${convo.id}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => undefined);
    };
    const poll = () => {
      void fetch(`/api/inbox/${convo.id}/presence`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (cancelled) return;
          setViewers(json?.data?.viewers || []);
        })
        .catch(() => undefined);
    };
    heartbeat();
    poll();
    const hb = setInterval(heartbeat, 20000);
    const pl = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(hb);
      clearInterval(pl);
    };
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "#92400e",
              background: "#fffbeb",
              borderTop: "1px solid #fde68a",
            }}
          >
            {composerDisabledReason}
          </div>
        ) : null}
        <ConversationsComposer
          onSend={(text, mediaUrls, fromE164) => {
            if (composeFromRef) composeFromRef.current = fromE164;
            onSend(text, mediaUrls);
          }}
          onNote={onNote}
          disabled={disabled || composerDisabled}
          prefill={prefill}
          onPrefillApplied={() => setPrefill("")}
          teammates={teammates}
          phoneNumbers={phoneNumbers}
          defaultFromNumberId={defaultFromNumberId}
        />
      </>
    ),
    [prefill, composerDisabled, composerDisabledReason, teammates, phoneNumbers, composeFromRef, defaultFromNumberId],
  );

  return (
    <div
      className="conversations-thread-area conversations-thread--mobile-full"
      style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        {viewers.length > 0 ? (
          <div className="tv-viewers-bar">
            <span className="tv-viewers-dot" />
            Also viewing: {viewers.map((v) => v.userName).join(", ")}
          </div>
        ) : null}
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
