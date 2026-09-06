"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot, Sparkles, Send, MessageSquareText, Mail, Phone, User, CalendarCheck2,
  ShieldCheck, Handshake, Copy, Check, AlertCircle, RotateCcw, Clock3,
  ArrowRight, Zap,
} from "lucide-react";
import {
  BOOKING_TYPES, CAPABILITY_CARDS, SUGGESTED_PROMPTS, mockOrchestratorReply,
  type Channel, type ChatMessage, type MockOrchestratorResult,
} from "../mock-data";

const LOCAL_TABS = ["Booking Types", "Booking Pages", "Availability", "AI Booking", "Routing", "Meeting Polls"];

interface Turn extends ChatMessage {
  result?: MockOrchestratorResult;
}

export function AiBookingClient() {
  const [channel, setChannel] = useState<Channel>("email");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [bookingType, setBookingType] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [lastResult, setLastResult] = useState<MockOrchestratorResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const convoRef = useRef<HTMLDivElement>(null);

  const activeTypes = useMemo(() => BOOKING_TYPES.filter((t) => t.active), []);

  function now() {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  async function send(text?: string) {
    const userLine = (text ?? message).trim();
    if (!userLine || loading) return;
    setLoading(true);
    setError("");
    setHistory((h) => [...h, { role: "user", content: userLine, at: now() }]);
    setMessage("");
    requestAnimationFrame(() => {
      convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: "smooth" });
    });

    // Sandbox: simulate POST /api/appointments/ai-booking
    await new Promise((r) => setTimeout(r, 1100));
    try {
      const result = mockOrchestratorReply(userLine, channel);
      setHistory((h) => [...h, { role: "assistant", content: result.message, at: now(), result }]);
      setLastResult(result);
    } catch {
      setError("The booking assistant couldn't process that request. Check the channel and identity details, then try again.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  function reset() {
    setHistory([]);
    setLastResult(null);
    setError("");
    setMessage("");
  }

  function copyPayload() {
    if (!lastResult) return;
    navigator.clipboard?.writeText(JSON.stringify(lastResult, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const identityReady = channel === "sms" ? phone.trim().length > 0 : email.trim().length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title font-display">AI Booking</h1>
          <p className="page-desc">
            Test the booking assistant your customers interact with over SMS and email. The assistant
            interprets requests, but availability, booking, and reminders are always decided by the
            scheduling engine — never by the model.
          </p>
        </div>
        <span className="chip chip-success" style={{ marginTop: 6 }}>
          <span className="dot" />
          Assistant active
        </span>
      </div>

      {/* Local navigation */}
      <div className="local-tabs" role="tablist">
        {LOCAL_TABS.map((tab) => (
          <span
            key={tab}
            role="tab"
            aria-selected={tab === "AI Booking"}
            className={`local-tab${tab === "AI Booking" ? " active" : ""}`}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="grid-2col">
        {/* Left column — console */}
        <div className="stack">
          {/* Channel & identity */}
          <section className="surface card-pad">
            <div className="card-head">
              <div>
                <h2 className="card-title">Test identity</h2>
                <p className="card-sub">Simulate an inbound customer message on a channel.</p>
              </div>
              <div className="segmented" role="group" aria-label="Channel">
                <button
                  className={`segment${channel === "email" ? " active" : ""}`}
                  onClick={() => setChannel("email")}
                >
                  <Mail size={13} /> Email
                </button>
                <button
                  className={`segment${channel === "sms" ? " active" : ""}`}
                  onClick={() => setChannel("sms")}
                >
                  <MessageSquareText size={13} /> SMS
                </button>
              </div>
            </div>

            <div className="form-grid">
              {channel === "sms" ? (
                <div>
                  <label className="field-label" htmlFor="f-phone">Customer phone</label>
                  <input
                    id="f-phone"
                    className="input"
                    placeholder="(571) 555-0142"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="field-hint">Used to match an existing contact and their consent state.</p>
                </div>
              ) : (
                <div>
                  <label className="field-label" htmlFor="f-email">Customer email</label>
                  <input
                    id="f-email"
                    className="input"
                    type="email"
                    placeholder="customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="field-hint">Used to match an existing contact record.</p>
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="f-contact">
                  Contact <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>— Optional</span>
                </label>
                <input
                  id="f-contact"
                  className="input"
                  placeholder="Search by name or ID"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                />
                <p className="field-hint">Link the test to a specific contact for history and eligibility.</p>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label" htmlFor="f-type">
                  Booking type <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>— Optional</span>
                </label>
                <select
                  id="f-type"
                  className="select"
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value)}
                >
                  <option value="">Any active booking type</option>
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.duration}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Scope availability to one booking type. Otherwise the assistant infers the best match.
                </p>
              </div>
            </div>

            {!identityReady && history.length === 0 ? (
              <div
                className="error-banner"
                style={{ marginTop: 14, background: "var(--warning-bg)", borderColor: "#fedf89", color: "var(--warning)" }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Add a {channel === "sms" ? "phone number" : "email address"} to test identity matching.
                  You can still send a message, but the assistant will treat the sender as a new contact.
                </span>
              </div>
            ) : null}
          </section>

          {/* Conversation */}
          <section className="surface card-pad">
            <div className="card-head">
              <div>
                <h2 className="card-title">Conversation</h2>
                <p className="card-sub">
                  Replies below are proposals — nothing is booked until the customer confirms.
                </p>
              </div>
              {history.length > 0 ? (
                <button className="btn btn-ghost btn-sm" onClick={reset}>
                  <RotateCcw size={13} />
                  Reset
                </button>
              ) : null}
            </div>

            {history.length > 0 || loading ? (
              <div className="convo" ref={convoRef} aria-live="polite">
                {history.map((m, i) => (
                  <div key={i} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                    {m.content}
                    <div className="bubble-meta">
                      {m.role === "user" ? "You" : "AI Booking assistant"} · {m.at}
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="bubble bubble-ai typing" aria-label="Assistant is processing">
                    <span /><span /><span />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="convo" style={{ alignItems: "center", justifyContent: "center" }}>
                <div className="empty-convo">
                  <div className="empty-convo-icon">
                    <Bot size={20} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>
                    No messages yet
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 4, maxWidth: 340, marginInline: "auto" }}>
                    Send a booking request below, or start from a suggested customer message.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="prompt-chips" style={{ marginBottom: 10 }}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <button key={p} className="prompt-chip" onClick={() => send(p)} disabled={loading}>
                    {p}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="f-message">Message</label>
              <textarea
                id="f-message"
                className="textarea"
                rows={3}
                placeholder="e.g. I'd like to book a cleaning next Tuesday afternoon"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {error ? (
                <div className="error-banner" style={{ marginTop: 10 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  Enter to send · Shift + Enter for a new line
                </span>
                <button className="btn btn-primary" onClick={() => send()} disabled={loading || !message.trim()}>
                  {loading ? (
                    <>Processing…</>
                  ) : (
                    <>
                      <Send size={14} />
                      Send to assistant
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Last result */}
          {lastResult ? (
            <section className="surface card-pad">
              <div className="payload-head">
                <div>
                  <h2 className="card-title">Last orchestrator result</h2>
                  <p className="card-sub">Structured output from the scheduling engine for the latest reply.</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={copyPayload}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px", marginBottom: 12 }}>
                <div className="kv"><span className="k">Type</span><span className="v">{lastResult.type}</span></div>
                <div className="kv"><span className="k">Intent</span><span className="v">{lastResult.intent}</span></div>
                <div className="kv"><span className="k">Confidence</span><span className="v">{Math.round(lastResult.confidence * 100)}%</span></div>
                <div className="kv"><span className="k">Slots checked</span><span className="v">{lastResult.slotsChecked}</span></div>
                <div className="kv"><span className="k">Timezone</span><span className="v">{lastResult.timezone}</span></div>
                <div className="kv"><span className="k">Actions</span><span className="v">{lastResult.actions.length}</span></div>
              </div>
              <pre className="payload">{JSON.stringify(lastResult, null, 2)}</pre>
            </section>
          ) : null}
        </div>

        {/* Right column — context */}
        <div className="stack">
          <section className="surface card-pad">
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div>
                <h2 className="card-title">How the assistant behaves</h2>
                <p className="card-sub">Applies to every customer conversation, not just this console.</p>
              </div>
            </div>
            <div className="cap-list">
              <div className="cap-item">
                <div className="cap-icon"><Sparkles size={15} /></div>
                <div>
                  <div className="cap-title">{CAPABILITY_CARDS[0].title}</div>
                  <p className="cap-body">{CAPABILITY_CARDS[0].body}</p>
                </div>
              </div>
              <div className="cap-item">
                <div className="cap-icon"><CalendarCheck2 size={15} /></div>
                <div>
                  <div className="cap-title">{CAPABILITY_CARDS[1].title}</div>
                  <p className="cap-body">{CAPABILITY_CARDS[1].body}</p>
                </div>
              </div>
              <div className="cap-item">
                <div className="cap-icon"><Handshake size={15} /></div>
                <div>
                  <div className="cap-title">{CAPABILITY_CARDS[2].title}</div>
                  <p className="cap-body">{CAPABILITY_CARDS[2].body}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface card-pad">
            <h2 className="card-title" style={{ marginBottom: 10 }}>Coverage</h2>
            <div className="kv"><span className="k">Channels</span><span className="v">SMS · Email</span></div>
            <div className="kv">
              <span className="k">Active booking types</span>
              <span className="v">{activeTypes.length} of {BOOKING_TYPES.length}</span>
            </div>
            <div className="kv"><span className="k">Availability source</span><span className="v">Standard Hours</span></div>
            <div className="kv"><span className="k">Reminder sequence</span><span className="v">Workspace default</span></div>
            <div className="kv"><span className="k">Voice reminders</span><span className="v">Press-1 confirmations</span></div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" style={{ width: "100%" }}>
                Manage booking types
                <ArrowRight size={13} />
              </button>
            </div>
          </section>

          <section className="surface card-pad">
            <div style={{ display: "flex", gap: 11px }}>
              <div className="cap-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                <ShieldCheck size={15} />
              </div>
              <div>
                <div className="cap-title">Consent is enforced, not assumed</div>
                <p className="cap-body" style={{ marginTop: 3 }}>
                  The assistant only sends SMS to contacts with valid permission for this sender. Eligibility is
                  re-checked at send time — a scheduled message never bypasses an opt-out.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 11px, marginTop: 12 }}>
              <div className="cap-icon">
                <Clock3 size={15} />
              </div>
              <div>
                <div className="cap-title">Times are always explicit</div>
                <p className="cap-body" style={{ marginTop: 3 }}>
                  Proposals include the appointment timezone (Eastern Time) so customers and staff never guess
                  which 2:00 PM was booked.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 11px, marginTop: 12 }}>
              <div className="cap-icon">
                <Zap size={15} />
              </div>
              <div>
                <div className="cap-title">Same engine, every entry point</div>
                <p className="cap-body" style={{ marginTop: 3 }}>
                  AI bookings, the public booking page, and staff-created appointments share one availability
                  and reminder engine.
                </p>
              </div>
            </div>
          </section>

          <section className="surface card-pad" style={{ background: "#fafbff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <User size={14} color="var(--primary)" />
              <h2 className="card-title">Testing tips</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              <li>Use a real contact's phone or email to test identity matching and history.</li>
              <li>Try vague requests ("next Friday") to check timezone clarification.</li>
              <li>Reply YES to a proposal to verify the confirmation path end to end.</li>
              <li>Requests the assistant can't fulfill hand off to Messages with context.</li>
            </ul>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
                <Phone size={13} />
                Test with a live conversation
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
