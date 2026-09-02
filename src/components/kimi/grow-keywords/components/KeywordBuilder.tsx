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
  Search,
  X,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import PhonePreview from "./PhonePreview";
import { contactLists as defaultContactLists, type Keyword } from "../mock-data";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        on ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-150 ${
          on ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

function MessageToolbar({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5">
      <div className="flex gap-0.5">
        {[Smile, ImagePlus, Braces].map((Icon, i) => (
          <button
            key={i}
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Lock size={12} className="text-muted-foreground/50" />
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {count}/918
        </span>
      </div>
    </div>
  );
}

function SectionHeader({
  num,
  title,
  open,
  onToggle,
}: {
  num: number;
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
      onClick={onToggle}
      aria-expanded={open}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
          open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {num}
      </span>
      <span
        className={`flex-1 text-[14px] font-semibold tracking-tight ${
          open ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {title}
      </span>
      {open ? (
        <ChevronDown size={16} className="text-muted-foreground" />
      ) : (
        <ChevronRight size={16} className="text-muted-foreground" />
      )}
    </button>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-foreground">{children}</span>
      {hint ? (
        <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30";

export default function KeywordBuilder({
  onBack,
  onSaved,
  contactLists = defaultContactLists,
  onSaveKeyword,
  editingKeyword,
}: {
  onBack: () => void;
  onSaved: () => void;
  contactLists?: string[];
  editingKeyword?: Keyword | null;
  onSaveKeyword?: (payload: {
    keywordId?: string;
    keyword: string;
    listName?: string;
    confirmation?: string;
    autoReply?: string;
    status?: string;
  }) => void | Promise<void>;
}) {
  const isEdit = Boolean(editingKeyword);
  const [setupOpen, setSetupOpen] = useState(true);
  const [behaviorOpen, setBehaviorOpen] = useState(false);

  const [keyword, setKeyword] = useState(editingKeyword?.name ?? "");
  const [description, setDescription] = useState(editingKeyword?.description ?? "");
  const [autoResponse, setAutoResponse] = useState(
    editingKeyword?.autoReply || "Thanks for subscribing to Transovo Tutorials text alerts.",
  );

  const [createContact, setCreateContact] = useState<"yes" | "no">(
    editingKeyword?.listName ? "yes" : "yes",
  );
  const [selectedLists, setSelectedLists] = useState<string[]>(
    editingKeyword?.listName ? [editingKeyword.listName] : [],
  );
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
  const [active, setActive] = useState(editingKeyword ? editingKeyword.status === "Active" : true);
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
          keywordId: editingKeyword?.id,
          keyword: keyword.trim(),
          listName: createContact === "yes" ? selectedLists[0] : undefined,
          confirmation: description.trim() || autoResponse,
          autoReply: autoResponse,
          status: active ? "Active" : "Inactive",
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
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        <button
          className="flex items-center gap-1 transition-colors hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft size={12} /> Grow
        </button>
        <span className="text-muted-foreground/50">/</span>
        <button className="transition-colors hover:text-foreground" onClick={onBack}>
          Keywords
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground">{isEdit ? "Edit Keyword" : "Create Keyword"}</span>
      </nav>

      <div className="flex items-start gap-9">
        {/* Left column */}
        <div className="min-w-0 max-w-[620px] flex-1">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquareText size={19} className="text-primary" />
            </div>
            <div>
              <h1 className="font-display text-[20px] font-semibold tracking-tight text-foreground">
                {isEdit ? "Edit Keyword" : "Create Keyword"}
              </h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {isEdit ? "Edit your keyword and auto response message." : "Create a new keyword and auto response message."}
              </p>
            </div>
          </div>

          {/* Setup section */}
          <div className="surface mb-3.5 overflow-hidden rounded-xl bg-card">
            <SectionHeader
              num={1}
              title="Setup"
              open={setupOpen}
              onToggle={() => setSetupOpen(!setupOpen)}
            />
            {setupOpen && (
              <div className="border-t border-border px-5 py-5">
                <div className="mb-4">
                  <FieldLabel>Keyword</FieldLabel>
                  <input
                    className={inputCls}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value.replace(/\s/g, ""))}
                    placeholder="e.g. JOIN"
                  />
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    One word, no spaces. Subscribers text this to your number to opt in.
                  </p>
                </div>
                <div className="mb-4">
                  <FieldLabel>Description</FieldLabel>
                  <input
                    className={inputCls}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this keyword for?"
                  />
                </div>
                <div>
                  <FieldLabel hint={`${autoResponse.length}/918`}>
                    Auto Response
                  </FieldLabel>
                  <div className="overflow-hidden rounded-lg border border-border bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
                    <textarea
                      className="min-h-[96px] w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
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
          <div className="surface mb-3.5 overflow-visible rounded-xl bg-card">
            <SectionHeader
              num={2}
              title="Contact Behavior"
              open={behaviorOpen}
              onToggle={() => setBehaviorOpen(!behaviorOpen)}
            />

            {behaviorOpen && (
              <div className="border-t border-border px-5 py-5">
                <p className="mb-5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                  Only list assignment, auto-response, and active status are saved today. Other behavior options below are preview-only.
                </p>
                <div className="mb-6">
                  <FieldLabel>
                    Create a subscribed contact when someone texts this keyword?
                  </FieldLabel>
                  <div className="inline-flex rounded-lg bg-muted p-1">
                    {(["yes", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCreateContact(opt)}
                        className={`h-8 rounded-md px-5 text-[13px] font-semibold capitalize transition-all duration-150 ${
                          createContact === opt
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>

                {createContact === "yes" && (
                  <>
                    {/* Add to lists */}
                    <div className="mb-6">
                      <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-foreground">
                        <ListChecks size={15} className="text-muted-foreground" />
                        Add the contact to one or more lists
                      </div>
                      <p className="mb-2.5 text-[12px] leading-relaxed text-muted-foreground">
                        When a contact is created after texting this keyword, you can
                        optionally add them to one or more lists.
                      </p>
                      <div className="relative">
                        <div
                          className="flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30"
                          onClick={() => setListDropOpen(true)}
                        >
                          {selectedLists.map((l) => (
                            <span
                              key={l}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-1 pl-2 pr-1 text-[12px] font-medium text-primary"
                            >
                              {l}
                              <button
                                type="button"
                                className="flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-primary/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLists(selectedLists.filter((x) => x !== l));
                                }}
                                aria-label={`Remove ${l}`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                          <input
                            className="min-w-[80px] flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                            placeholder={selectedLists.length ? "" : "Search lists"}
                            value={listSearch}
                            onChange={(e) => {
                              setListSearch(e.target.value);
                              setListDropOpen(true);
                            }}
                            onFocus={() => setListDropOpen(true)}
                          />
                          <Search size={14} className="text-muted-foreground/60" />
                        </div>
                        {listDropOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setListDropOpen(false)}
                            />
                            <div className="kw-fade absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-lg">
                              {filteredLists.length === 0 && (
                                <div className="px-3.5 py-2.5 text-[13px] text-muted-foreground">
                                  No lists match your search.
                                </div>
                              )}
                              {filteredLists.map((l) => (
                                <button
                                  key={l}
                                  type="button"
                                  className="flex w-full items-center px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                                  onClick={() => {
                                    setSelectedLists([...selectedLists, l]);
                                    setListSearch("");
                                  }}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alternate responses */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[13px] font-medium text-foreground">
                            Alternate opt-in responses
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                            Customize the messages sent to contacts who are already
                            subscribed or who resubscribe.
                          </p>
                        </div>
                        <Toggle on={alternateOn} onClick={() => setAlternateOn(!alternateOn)} />
                      </div>

                      {alternateOn && (
                        <div className="kw-fade mt-4 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                          <div>
                            <FieldLabel hint={`${alreadyOpted.length}/918`}>
                              Already subscribed message
                            </FieldLabel>
                            <textarea
                              className="min-h-[72px] w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                              value={alreadyOpted}
                              maxLength={918}
                              onChange={(e) => setAlreadyOpted(e.target.value)}
                            />
                          </div>
                          <div>
                            <FieldLabel hint={`${reOptIn.length}/918`}>
                              Resubscribe message
                            </FieldLabel>
                            <textarea
                              className="min-h-[72px] w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                              value={reOptIn}
                              maxLength={918}
                              onChange={(e) => setReOptIn(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Double opt-in */}
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
                      <div>
                        <div className="text-[13px] font-medium text-foreground">
                          Require double opt-in
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                          Ask new contacts to confirm their subscription before being added.
                        </p>
                      </div>
                      <Toggle on={doubleOptIn} onClick={() => setDoubleOptIn(!doubleOptIn)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="surface sticky bottom-4 flex items-center justify-between gap-4 rounded-xl bg-card px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Toggle on={active} onClick={() => setActive(!active)} />
              <span className="text-[13px] font-medium text-foreground">
                {active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-muted px-4 text-sm font-semibold text-foreground transition-colors hover:bg-border/70"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !keyword.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                onClick={handleSave}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Keyword"}
              </button>
            </div>
          </div>
        </div>

        {/* Right column — phone preview */}
        <PhonePreview keyword={keyword} message={autoResponse} />
      </div>
    </div>
  );
}
