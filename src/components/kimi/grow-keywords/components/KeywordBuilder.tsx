"use client";

import { useState } from "react";
import {
  MessageSquareText,
  ChevronDown,
  ChevronRight,
  Smile,
  ImagePlus,
  Braces,
  Lock,
  ListChecks,
  HelpCircle,
  Search,
  X,
  List,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";
import PhonePreview from "./PhonePreview";
import { contactLists as defaultContactLists } from "../mock-data";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`kw-toggle ${on ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={on}
    />
  );
}

function MessageToolbar({ count }: { count: number }) {
  return (
    <div className="kw-msg-toolbar">
      <div style={{ display: "flex", gap: 2 }}>
        {[Smile, ImagePlus, Braces].map((Icon, i) => (
          <button key={i} type="button" className="kw-toolbar-btn">
            <Icon size={15} />
          </button>
        ))}
      </div>
      <Lock size={13} color="#c0c4d8" />
      <span style={{ display: "none" }}>{count}</span>
    </div>
  );
}

export default function KeywordBuilder({
  onBack,
  onSaved,
  contactLists = defaultContactLists,
  onSaveKeyword,
}: {
  onBack: () => void;
  onSaved: () => void;
  contactLists?: string[];
  onSaveKeyword?: (payload: {
    keyword: string;
    listName?: string;
    confirmation?: string;
    autoReply?: string;
  }) => void | Promise<void>;
}) {
  const [setupOpen, setSetupOpen] = useState(true);
  const [behaviorOpen, setBehaviorOpen] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [description, setDescription] = useState("");
  const [autoResponse, setAutoResponse] = useState(
    "Thanks for subscribing to Transovo Tutorials text alerts."
  );

  const [createContact, setCreateContact] = useState<"yes" | "no">("yes");
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listDropOpen, setListDropOpen] = useState(false);
  const [alternateOn, setAlternateOn] = useState(false);
  const [alreadyOpted, setAlreadyOpted] = useState(
    "You're already subscribed to Transovo Tutorials text alerts."
  );
  const [reOptIn, setReOptIn] = useState(
    "You've resubscribed to Transovo Tutorials text alerts."
  );
  const [doubleOptIn, setDoubleOptIn] = useState(false);
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredLists = contactLists.filter(
    (l) =>
      l.toLowerCase().includes(listSearch.toLowerCase()) && !selectedLists.includes(l)
  );

  const handleSave = () => {
    setSaving(true);
    const done = () => {
      setSaving(false);
      onSaved();
    };
    if (onSaveKeyword && keyword.trim()) {
      void Promise.resolve(
        onSaveKeyword({
          keyword: keyword.trim(),
          listName: selectedLists[0],
          confirmation: autoResponse,
          autoReply: autoResponse,
        }),
      )
        .then(done)
        .catch(() => setSaving(false));
      return;
    }
    setTimeout(done, 700);
  };

  return (
    <div className="kw-fade">
      {/* Breadcrumb */}
      <div className="kw-breadcrumb">
        <button className="kw-breadcrumb-link" onClick={onBack}>
          <ArrowLeft size={12} /> Grow
        </button>
        <span className="kw-breadcrumb-sep">/</span>
        <button className="kw-breadcrumb-link" onClick={onBack}>
          Keywords
        </button>
        <span className="kw-breadcrumb-sep">/</span>
        <span className="kw-breadcrumb-current">Create Keyword</span>
      </div>

      <div style={{ display: "flex", gap: 36, alignItems: "flex-start" }}>
        {/* Left column */}
        <div style={{ flex: 1, maxWidth: 620, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            <div className="kw-header-icon">
              <MessageSquareText size={20} color="#4f46e5" />
            </div>
            <div>
              <h1 className="kw-page-title">Create Keyword</h1>
              <p className="kw-page-subtitle">
                Create a new keyword and auto response message.
              </p>
            </div>
          </div>

          {/* Setup section */}
          <div className="kw-card" style={{ marginBottom: 14, overflow: "hidden" }}>
            <div className="kw-section-header" onClick={() => setSetupOpen(!setupOpen)}>
              <span className={`kw-section-num ${setupOpen ? "" : "muted"}`}>1</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  color: setupOpen ? "#1f2440" : "#6a708c",
                }}
              >
                Setup
              </span>
              {setupOpen ? (
                <ChevronDown size={16} color="#8a8fa8" />
              ) : (
                <ChevronRight size={16} color="#8a8fa8" />
              )}
            </div>
            {setupOpen && (
              <div style={{ padding: "18px 20px" }}>
                <div style={{ marginBottom: 16 }}>
                  <div className="kw-label">
                    <span>Keyword</span>
                  </div>
                  <input
                    className="kw-input"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value.replace(/\s/g, ""))}
                    placeholder="e.g. JOIN"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="kw-label">
                    <span>Description</span>
                  </div>
                  <input
                    className="kw-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this keyword for?"
                  />
                </div>
                <div>
                  <div className="kw-label">
                    <span>Auto Response</span>
                    <span style={{ fontWeight: 500, color: "#8a8fa8" }}>
                      {autoResponse.length}/918
                    </span>
                  </div>
                  <div className="kw-textarea-wrap">
                    <textarea
                      className="kw-input"
                      style={{
                        border: "none",
                        borderRadius: 0,
                        minHeight: 96,
                        resize: "vertical",
                        fontFamily: "inherit",
                        lineHeight: 1.5,
                      }}
                      value={autoResponse}
                      maxLength={918}
                      onChange={(e) => setAutoResponse(e.target.value)}
                    />
                    <MessageToolbar count={autoResponse.length} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact Behavior section */}
          <div className="kw-card" style={{ marginBottom: 14, overflow: "visible" }}>
            <div className="kw-section-header" onClick={() => setBehaviorOpen(!behaviorOpen)}>
              <span className={`kw-section-num ${behaviorOpen ? "" : "muted"}`}>2</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  color: behaviorOpen ? "#1f2440" : "#6a708c",
                }}
              >
                Contact Behavior
              </span>
              {behaviorOpen ? (
                <ChevronDown size={16} color="#8a8fa8" />
              ) : (
                <ChevronRight size={16} color="#8a8fa8" />
              )}
            </div>

            {behaviorOpen && (
              <div style={{ padding: "18px 20px" }}>
                <div style={{ marginBottom: 22 }}>
                  <div className="kw-label" style={{ marginBottom: 10 }}>
                    <span>Create a subscribed contact when someone texts this keyword?</span>
                  </div>
                  <div className="kw-segment">
                    <button
                      className={createContact === "yes" ? "active" : ""}
                      onClick={() => setCreateContact("yes")}
                    >
                      Yes
                    </button>
                    <button
                      className={createContact === "no" ? "active" : ""}
                      onClick={() => setCreateContact("no")}
                    >
                      No
                    </button>
                  </div>
                </div>

                {createContact === "yes" && (
                  <>
                    {/* Add to lists */}
                    <div style={{ marginBottom: 22 }}>
                      <div className="kw-field-heading">
                        <ListChecks size={15} color="#4a5070" />
                        <span>Add the contact to one or more lists</span>
                      </div>
                      <p className="kw-field-help">
                        When a contact is created after texting this keyword, you can
                        optionally add them to one or more lists.
                      </p>
                      <div style={{ position: "relative" }}>
                        <div
                          className="kw-input"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                            cursor: "text",
                            minHeight: 40,
                            padding: "5px 10px",
                          }}
                          onClick={() => setListDropOpen(true)}
                        >
                          {selectedLists.map((l) => (
                            <span key={l} className="kw-chip">
                              {l}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLists(selectedLists.filter((x) => x !== l));
                                }}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          <input
                            style={{
                              border: "none",
                              outline: "none",
                              flex: 1,
                              minWidth: 80,
                              fontSize: 13.5,
                              background: "transparent",
                            }}
                            placeholder={selectedLists.length ? "" : "Search"}
                            value={listSearch}
                            onChange={(e) => {
                              setListSearch(e.target.value);
                              setListDropOpen(true);
                            }}
                            onFocus={() => setListDropOpen(true)}
                          />
                          <Search size={14} color="#a3a8c0" />
                        </div>
                        {listDropOpen && (
                          <>
                            <div
                              style={{ position: "fixed", inset: 0, zIndex: 30 }}
                              onClick={() => setListDropOpen(false)}
                            />
                            <div
                              className="kw-dropdown kw-fade"
                              style={{ left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 40 }}
                            >
                              {filteredLists.map((l) => (
                                <button
                                  key={l}
                                  onClick={() => {
                                    setSelectedLists([...selectedLists, l]);
                                    setListSearch("");
                                    setListDropOpen(false);
                                  }}
                                >
                                  <List size={14} color="#8a8fa8" /> {l}
                                </button>
                              ))}
                              {filteredLists.length === 0 && (
                                <div style={{ padding: "10px 12px", fontSize: 13, color: "#8a8fa8" }}>
                                  No lists found
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alternate response */}
                    <div style={{ marginBottom: 22 }}>
                      <div className="kw-toggle-row">
                        <div className="kw-field-heading" style={{ marginBottom: 0 }}>
                          <HelpCircle size={15} color="#4a5070" />
                          <span>Send an alternate response if a contact exists</span>
                        </div>
                        <Toggle on={alternateOn} onClick={() => setAlternateOn(!alternateOn)} />
                      </div>
                      <p className="kw-field-help">
                        If a person already exists as a contact when texting this keyword,
                        you can send a different auto-response. This is optional.
                      </p>
                      {alternateOn && (
                        <div className="kw-fade">
                          <div style={{ marginBottom: 14 }}>
                            <div className="kw-label">
                              <span>Response When a Contact is Already Opted In</span>
                              <span style={{ fontWeight: 500, color: "#8a8fa8" }}>
                                {alreadyOpted.length}/918
                              </span>
                            </div>
                            <div className="kw-textarea-wrap">
                              <textarea
                                className="kw-input"
                                style={{
                                  border: "none",
                                  borderRadius: 0,
                                  minHeight: 72,
                                  resize: "vertical",
                                  fontFamily: "inherit",
                                  lineHeight: 1.5,
                                }}
                                value={alreadyOpted}
                                maxLength={918}
                                onChange={(e) => setAlreadyOpted(e.target.value)}
                              />
                              <MessageToolbar count={alreadyOpted.length} />
                            </div>
                          </div>
                          <div>
                            <div className="kw-label">
                              <span>Response When a Contact is Re-Opting In</span>
                              <span style={{ fontWeight: 500, color: "#8a8fa8" }}>
                                {reOptIn.length}/918
                              </span>
                            </div>
                            <div className="kw-textarea-wrap">
                              <textarea
                                className="kw-input"
                                style={{
                                  border: "none",
                                  borderRadius: 0,
                                  minHeight: 72,
                                  resize: "vertical",
                                  fontFamily: "inherit",
                                  lineHeight: 1.5,
                                }}
                                value={reOptIn}
                                maxLength={918}
                                onChange={(e) => setReOptIn(e.target.value)}
                              />
                              <MessageToolbar count={reOptIn.length} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Double opt-in */}
                    <div>
                      <div className="kw-toggle-row">
                        <div className="kw-field-heading" style={{ marginBottom: 0 }}>
                          <BadgeCheck size={15} color="#4a5070" />
                          <span>Require Double Opt-In</span>
                        </div>
                        <Toggle on={doubleOptIn} onClick={() => setDoubleOptIn(!doubleOptIn)} />
                      </div>
                      <p className="kw-field-help" style={{ marginBottom: 0 }}>
                        When enabled, after someone texts your keyword, they&apos;ll receive a
                        message asking them to confirm before subscribing. They&apos;ll have to
                        reply with the word <strong>YES</strong> to complete the process.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer: active toggle + save */}
          <div className="kw-save-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle on={active} onClick={() => setActive(!active)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: active ? "#1f2440" : "#6a708c" }}>
                Active
              </span>
            </div>
            <button className="kw-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Right column: preview */}
        <PhonePreview keyword={keyword} message={autoResponse} />
      </div>
    </div>
  );
}
