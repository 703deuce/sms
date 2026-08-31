"use client";
import { useState } from "react";
import "./reference.css";
import Sidebar from "./components/Sidebar";
import Toggle from "./components/Toggle";
import MessageAccordion from "./components/MessageAccordion";
import PhonePreview from "./components/PhonePreview";
import { optInMessages, complianceMessages, days } from "./mock-data";
import { MessageSquareText, ShieldCheck, Inbox, CheckCircle2 } from "lucide-react";

type Tab = "optin" | "compliance" | "inbox";

export default function ReferencePage() {
  const [tab, setTab] = useState<Tab>("optin");
  const [toast, setToast] = useState<string | null>(null);

  // Opt-in message state
  const [bodies, setBodies] = useState<Record<string, string>>(
    Object.fromEntries(optInMessages.map((m) => [m.id, m.body]))
  );

  // Keyword override preview state
  const [kwReply, setKwReply] = useState("Use code BF20 for 20% off. Offer expires Nov 30th");

  // Inbox settings state
  const [inboxAuto, setInboxAuto] = useState(true);
  const [insideMsg, setInsideMsg] = useState("Thanks for reaching out. We'll get back to you briefly.");
  const [outsideMsg, setOutsideMsg] = useState(
    "Thanks for reaching out. Our office hours are 9 am - 5 pm M-F. Someone will get back to you during those hours!"
  );
  const [officeHours, setOfficeHours] = useState(true);
  const [activeDays, setActiveDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday"]);

  // General toggles
  const [prefix, setPrefix] = useState(false);
  const [badNumber, setBadNumber] = useState(false);

  const save = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="tv-app">
      <Sidebar />
      <main className="tv-main">
        <div className="tv-crumb">Settings / General · Auto-Replies</div>
        <h1 className="tv-h1">
          <MessageSquareText size={22} style={{ color: "var(--brand)" }} />
          Auto-Replies
        </h1>
        <p className="tv-sub">
          Set the default automated messages used throughout the platform and in contact messaging experiences.
        </p>

        <div className="tv-tabs">
          <button className={`tv-tab ${tab === "optin" ? "active" : ""}`} onClick={() => setTab("optin")}>
            Opt-In Messaging
          </button>
          <button className={`tv-tab ${tab === "compliance" ? "active" : ""}`} onClick={() => setTab("compliance")}>
            Compliance Messaging
          </button>
          <button className={`tv-tab ${tab === "inbox" ? "active" : ""}`} onClick={() => setTab("inbox")}>
            Inbox Auto-Response
          </button>
        </div>

        {tab === "optin" && (
          <>
            <div className="tv-card">
              <div className="tv-setting-row">
                <div>
                  <div className="tv-setting-title">Message Prefix</div>
                  <div className="tv-setting-desc">
                    This is a word or phrase added to the beginning of all outgoing text messages to help contacts
                    easily identify who the message is from. Your messages would read <b>prefix: your message here</b>.
                  </div>
                </div>
                <Toggle on={prefix} onChange={setPrefix} />
              </div>
            </div>
            <div className="tv-card">
              <div className="tv-setting-row">
                <div>
                  <div className="tv-setting-title">Bad Number Deletion</div>
                  <div className="tv-setting-desc">
                    Our system is constantly monitoring message delivery. If patterns of consecutive message failures
                    to individual contacts are recognized, they can be deleted automatically.
                  </div>
                </div>
                <Toggle on={badNumber} onChange={setBadNumber} />
              </div>
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "26px 0 6px" }}>Messaging</h2>
            <p className="tv-sub" style={{ marginBottom: 14 }}>
              Here is where you can set default messaging that will be used in various places throughout the
              platform and in contact messaging experiences.
            </p>

            {optInMessages.map((m, i) => (
              <MessageAccordion
                key={m.id}
                msg={m}
                value={bodies[m.id]}
                onChange={(v) => setBodies({ ...bodies, [m.id]: v })}
                defaultOpen={i === 0}
              />
            ))}

            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "30px 0 6px" }}>Keyword Override Preview</h2>
            <p className="tv-sub" style={{ marginBottom: 14 }}>
              Each opt-in method (like the <b>BlackFriday</b> keyword) can override the default Opt-In Message.
            </p>
            <div className="tv-split">
              <div className="tv-card" style={{ marginBottom: 0 }}>
                <div className="tv-label-row"><span>Keyword</span></div>
                <input className="tv-textarea" style={{ minHeight: 0, marginBottom: 14 }} defaultValue="BlackFriday" readOnly />
                <div className="tv-label-row"><span>Description</span></div>
                <input className="tv-textarea" style={{ minHeight: 0, marginBottom: 14 }} defaultValue="Joined during our Black Friday sale." readOnly />
                <div className="tv-label-row">
                  <span>Auto Response</span>
                  <span>{kwReply.length}/918</span>
                </div>
                <textarea
                  className="tv-textarea"
                  value={kwReply}
                  maxLength={918}
                  onChange={(e) => setKwReply(e.target.value)}
                />
              </div>
              <PhonePreview keyword="BlackFriday" message={kwReply} />
            </div>

            <div className="tv-actions">
              <button className="tv-btn tv-btn-primary" onClick={() => save("Settings saved")}>Save</button>
              <button className="tv-btn tv-btn-ghost">Back</button>
            </div>
          </>
        )}

        {tab === "compliance" && (
          <>
            <div className="tv-card">
              <div className="tv-setting-row">
                <div>
                  <div className="tv-setting-title flex items-center gap-2">
                    <ShieldCheck size={16} style={{ color: "var(--brand)" }} /> Force Double Opt-In
                  </div>
                  <div className="tv-setting-desc">
                    Some opt-in methods, such as web forms and website popups require contacts to double opt-in before
                    subscribing. When people subscribe, they&apos;ll first be sent a message prompting them to reply
                    YES before successfully subscribing.
                  </div>
                </div>
                <Toggle on={true} onChange={() => {}} />
              </div>
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "26px 0 6px" }}>Compliance Messaging</h2>
            <p className="tv-sub" style={{ marginBottom: 14 }}>
              The TCPA and cellular carriers require all mobile messaging programs to provide specific verbiage in
              different places throughout the subscriber experience. <b>Transovo includes this information for you
              in all the necessary places.</b> This content is simply here for your reference.
            </p>

            {complianceMessages.map((m, i) => (
              <MessageAccordion key={m.id} msg={m} value={m.body} defaultOpen={i === 1} />
            ))}

            <div className="tv-actions">
              <button className="tv-btn tv-btn-primary" onClick={() => save("Settings saved")}>Save</button>
              <button className="tv-btn tv-btn-ghost">Back</button>
            </div>
          </>
        )}

        {tab === "inbox" && (
          <>
            <div className="tv-card">
              <div className="tv-setting-row">
                <div>
                  <div className="tv-setting-title flex items-center gap-2">
                    <Inbox size={16} style={{ color: "var(--brand)" }} /> Office Hours
                  </div>
                  <div className="tv-setting-desc">
                    Specify the days and times that teammates are generally online and available. Setting office hours
                    splits your inbox auto-response into inside / outside hours messages.
                  </div>
                </div>
                <Toggle on={officeHours} onChange={setOfficeHours} />
              </div>
              {officeHours && (
                <div className="tv-hours">
                  {days.map((d) => {
                    const on = activeDays.includes(d);
                    return (
                      <div key={d} className={`tv-hour-row ${on ? "" : "tv-dim"}`}>
                        <button
                          className={`tv-day-chip ${on ? "on" : ""}`}
                          onClick={() =>
                            setActiveDays(on ? activeDays.filter((x) => x !== d) : [...activeDays, d])
                          }
                        >
                          {d}
                        </button>
                        <select className="tv-select" defaultValue="9:00 am">
                          {["8:00 am", "9:00 am", "10:00 am"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                        <span>To</span>
                        <select className="tv-select" defaultValue="5:00 pm">
                          {["4:00 pm", "5:00 pm", "6:00 pm"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                        <span className="tv-tz">CDT</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="tv-card">
              <div className="tv-setting-row">
                <div>
                  <div className="tv-setting-title">Inbox Auto-Response</div>
                  <div className="tv-setting-desc">
                    Send a standard automated response in conversations that are opened as a result of a new
                    inbound message.
                  </div>
                </div>
                <Toggle on={inboxAuto} onChange={setInboxAuto} />
              </div>

              {inboxAuto && (
                <div style={{ marginTop: 18 }}>
                  <div className="tv-label-row">
                    <span>{officeHours ? "Auto-Response Message Inside of Office Hours" : "Auto-Response Message"}</span>
                    <span>{insideMsg.length}/918</span>
                  </div>
                  <textarea
                    className="tv-textarea"
                    value={insideMsg}
                    maxLength={918}
                    onChange={(e) => setInsideMsg(e.target.value)}
                  />
                  {officeHours && (
                    <div style={{ marginTop: 16 }}>
                      <div className="tv-label-row">
                        <span>Auto-Response Message Outside of Office Hours</span>
                        <span>{outsideMsg.length}/918</span>
                      </div>
                      <textarea
                        className="tv-textarea"
                        value={outsideMsg}
                        maxLength={918}
                        onChange={(e) => setOutsideMsg(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tv-actions">
              <button className="tv-btn tv-btn-primary" onClick={() => save("Inbox settings saved")}>Save</button>
              <button className="tv-btn tv-btn-ghost">Back</button>
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="tv-toast">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
