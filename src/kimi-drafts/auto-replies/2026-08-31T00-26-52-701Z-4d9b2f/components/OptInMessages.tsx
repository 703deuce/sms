"use client";
import React, { useState } from "react";
import { optInMessages as optInInit, complianceMessages } from "../mock-data";
import { MessageAccordion } from "./Shared";

export default function OptInMessages() {
  const [messages, setMessages] = useState(optInInit);
  const [openId, setOpenId] = useState<string | null>("optin");
  const [openCompliance, setOpenCompliance] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-[15px] font-bold">Messaging</h2>
      <p className="mt-1 mb-5 text-[13px] tv-muted">
        Here is where you can set default messaging that will be used in various places throughout the platform and in contact messaging experiences.
      </p>
      {messages.map((m) => (
        <MessageAccordion
          key={m.id}
          title={m.title}
          description={m.description}
          body={m.body}
          editable={m.editable}
          open={openId === m.id}
          onToggle={() => setOpenId(openId === m.id ? null : m.id)}
          onChange={(v) => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, body: v } : x)))}
        />
      ))}

      <h2 className="text-[15px] font-bold mt-10">Compliance Messaging</h2>
      <p className="mt-1 mb-5 text-[13px] tv-muted">
        The TCPA and cellular carriers require all mobile messaging programs to provide specific verbiage in different places throughout the subscriber experience. <span className="font-semibold text-[#3d4460]">Transovo includes this information for you in all the necessary places.</span> This content is simply here for your reference.
      </p>
      {complianceMessages.map((m) => (
        <MessageAccordion
          key={m.id}
          title={m.title}
          description={m.description}
          body={m.body}
          editable={m.editable}
          open={openCompliance === m.id}
          onToggle={() => setOpenCompliance(openCompliance === m.id ? null : m.id)}
        />
      ))}
    </div>
  );
}
