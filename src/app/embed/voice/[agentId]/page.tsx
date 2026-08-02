"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Embeddable AI chat widget — uses short-lived session tokens (no Telnyx keys in browser).
 */
export default function VoiceWidgetEmbedPage() {
  const params = useParams();
  const agentId = String(params.agentId || "");
  const [sessionToken, setSessionToken] = useState("");
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<Array<{ role: string; text: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) return;
    fetch("/api/public/voice/widget/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Session failed");
        setSessionToken(j.data.token);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [agentId]);

  async function send() {
    if (!message.trim() || !agentId || !sessionToken) return;
    setBusy(true);
    setError("");
    const userText = message.trim();
    setMessage("");
    setLog((prev) => [...prev, { role: "user", text: userText }]);
    try {
      const res = await fetch("/api/public/voice/widget/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, message: userText, sessionToken }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Chat failed");
      const data = j.data;
      const reply =
        typeof data === "string"
          ? data
          : data?.reply ||
            data?.message ||
            data?.choices?.[0]?.message?.content ||
            JSON.stringify(data);
      setLog((prev) => [...prev, { role: "assistant", text: String(reply) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#0f1419] p-4 text-[#e8eef4]">
      <header className="mb-3 border-b border-white/10 pb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7eb8c9]">Transovo Voice</p>
        <h1 className="text-lg font-semibold">Assistant chat</h1>
        <p className="text-[11px] text-white/50">
          {sessionToken ? "Secure session active" : "Starting session…"}
        </p>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto text-sm">
        {log.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-8 rounded-lg bg-[#1c3a4a] px-3 py-2"
                : "mr-8 rounded-lg bg-[#1a2229] px-3 py-2"
            }
          >
            {m.text}
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded border border-white/15 bg-[#12181e] px-3 py-2 text-sm outline-none focus:border-[#7eb8c9]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Type a message…"
          disabled={busy || !sessionToken}
        />
        <button
          type="button"
          className="rounded bg-[#2a6f82] px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={busy || !message.trim() || !sessionToken}
          onClick={() => void send()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
