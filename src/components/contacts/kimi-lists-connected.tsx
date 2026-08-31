/**
 * Backend adapter shell for Kimi contacts-lists.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/kimi/contacts-lists/components/Sidebar";
import ListsPage from "@/components/kimi/contacts-lists/components/ListsPage";
import CreateListPage from "@/components/kimi/contacts-lists/components/CreateListPage";
import ContactsPage from "@/components/kimi/contacts-lists/components/ContactsPage";
import KeywordEditor from "@/components/kimi/contacts-lists/components/KeywordEditor";
import type { ContactList, Contact, Keyword } from "@/components/kimi/contacts-lists/mock-data";
import {
  addContactsToList,
  createList,
  fetchContactsForLists,
  fetchKeywordsForLists,
  fetchLists,
  updateKeywordForList,
} from "@/lib/contacts/kimi-lists-adapter";
import {
  Users, ListTodo, Wrench, LayoutTemplate, MonitorSmartphone, MessageSquareText,
  QrCode, MousePointerClick, Search, MoreVertical, CheckCircle2, ArrowUpRight,
} from "lucide-react";

export function KimiListsConnected() {
  const searchParams = useSearchParams();
  const editKeywordId = searchParams.get("editKeyword");
  const [page, setPage] = useState<Page>("lists");
  const [lists, setLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [l, c, k] = await Promise.all([fetchLists(), fetchContactsForLists(), fetchKeywordsForLists()]);
    setLists(l);
    setContacts(c);
    setKeywords(k);
  }, []);

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load lists"))
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (!editKeywordId || keywords.length === 0) return;
    const kw = keywords.find((k) => k.id === editKeywordId);
    if (!kw) return;
    setEditingKeyword(kw);
    setPage("keyword");
  }, [editKeywordId, keywords]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const saveList = async (name: string, description: string) => {
    try {
      const created = await createList(name, description);
      setLists((prev) => [created, ...prev]);
      setPage("lists");
      showToast("List created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list");
    }
  };

  const addToLists = async (contactIds: string[], listIds: string[]) => {
    try {
      await Promise.all(listIds.map((listId) => addContactsToList(listId, contactIds)));
      await reload();
      showToast("Contacts successfully added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add contacts to list");
    }
  };

  const saveKeyword = async (payload: {
    listId: string | null;
    keyword: string;
    description: string;
    autoResponse: string;
  }) => {
    if (!editingKeyword) {
      setPage("tools");
      return;
    }
    setError("");
    try {
      const listName = payload.listId ? lists.find((l) => l.id === payload.listId)?.name : undefined;
      await updateKeywordForList(editingKeyword.id, {
        keyword: payload.keyword,
        listName,
        confirmation: payload.description,
        autoReply: payload.autoResponse,
      });
      await reload();
      setPage("tools");
      setEditingKeyword(null);
      showToast("Keyword saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save keyword");
    }
  };

  const activeTab: "contacts" | "lists" | "tools" =
    page === "contacts" ? "contacts" : page === "tools" || page === "keyword" ? "tools" : "lists";
  const showTabs = page === "lists" || page === "contacts" || page === "tools";

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">Loading lists…</p>;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#0f1b3d]">
      <main className="mx-auto max-w-[1160px] px-8 pb-16">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {showTabs && (
          <div className="page-tabs">
            <button className={`page-tab ${activeTab === "contacts" ? "active" : ""}`} onClick={() => setPage("contacts")}>
              <Users size={14} /> Contacts
            </button>
            <button className={`page-tab ${activeTab === "lists" ? "active" : ""}`} onClick={() => setPage("lists")}>
              <ListTodo size={14} /> Lists
            </button>
            <button className={`page-tab ${activeTab === "tools" ? "active" : ""}`} onClick={() => setPage("tools")}>
              <Wrench size={14} /> Tools
            </button>
          </div>
        )}
        {page === "lists" && <ListsPage lists={lists} onCreate={() => setPage("createList")} />}
        {page === "createList" && <CreateListPage onBack={() => setPage("lists")} onSave={saveList} />}
        {page === "contacts" && <ContactsPage contacts={contacts} lists={lists} onAddToLists={addToLists} />}
        {page === "tools" && (
          <ToolsPage
            keywords={keywords}
            onEditKeyword={(k) => {
              setEditingKeyword(k);
              setPage("keyword");
            }}
          />
        )}
        {page === "keyword" && editingKeyword && (
          <KeywordEditor
            lists={lists}
            keywordId={editingKeyword.id}
            initialKeyword={editingKeyword.keyword}
            initialDescription={editingKeyword.description}
            initialAutoResponse={editingKeyword.autoResponse}
            onSave={(payload) => void saveKeyword(payload)}
            onCancel={() => { setEditingKeyword(null); setPage("tools"); }}
          />
        )}
      </main>
      {toast && (
        <div className="toast"><CheckCircle2 size={14} /> {toast}</div>
      )}
    </div>
  );
}

function ToolsPage({ keywords, onEditKeyword }: { keywords: Keyword[]; onEditKeyword: (k: Keyword) => void }) {
  const [view, setView] = useState<"tools" | "keywords">("tools");
  const cards = [
    { icon: <LayoutTemplate size={19} />, title: "Landing Pages", desc: "Build landing pages or embedded forms that collect contact data and opt people into your audience." },
    { icon: <MonitorSmartphone size={19} />, title: "Website Popups", desc: "Create fully branded website popups that capture visitor information and allow them to subscribe." },
    { icon: <MessageSquareText size={19} />, title: "Keywords", desc: "Establish keywords that users can text to join your lists or get automated replies.", onClick: () => setView("keywords") },
    { icon: <QrCode size={19} />, title: "QR Codes", desc: "Generate a QR Code that opens a new message with your keyword and number pre-filled or sends users to a destination of your choice." },
    { icon: <MousePointerClick size={19} />, title: "Tap-to-Join Links", desc: "Tap-to-join links open a new message with your keyword and number pre-filled, so the user can simply hit send to subscribe." },
  ];

  if (view === "keywords") {
    return (
      <div>
        <div className="breadcrumb">Tools / <span>Keywords</span></div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="page-title"><MessageSquareText size={19} className="text-[#3b4ef5]" /> Keywords</h1>
            <p className="page-subtitle">View and manage all of your keywords.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
              <input className="input pl-8 w-[220px]" placeholder="Search" />
            </div>
            <button className="btn-primary" onClick={() => window.location.assign("/grow/keywords")}>Create Keyword</button>
          </div>
        </div>
        <div className="table-card">
          <div className="table-head grid grid-cols-[1fr_1.6fr_220px_40px]">
            <span>KEYWORD</span><span>DESCRIPTION</span><span className="text-right">CREATES CONTACTS</span><span></span>
          </div>
          {keywords.map((k) => (
            <div key={k.id} className="table-row grid grid-cols-[1fr_1.6fr_220px_40px]">
              <div>
                <div className="cell-primary">{k.keyword}</div>
                <div className="cell-sub">Last saved on {k.lastSaved}</div>
              </div>
              <div className="cell-body">{k.description}</div>
              <div className="flex items-center gap-3 justify-end">
                <span className="flex items-center gap-1.5 text-[12px] text-[#7a85a8]">
                  <span className="count-badge">{k.connectedLists}</span>
                  Connected List{k.connectedLists === 1 ? "" : "s"}
                </span>
                <span className="pill pill-green">Yes</span>
              </div>
              <MoreVertical size={15} className="text-[#9aa3c0] cursor-pointer hover:text-[#44507a]" onClick={() => onEditKeyword(k)} />
            </div>
          ))}
          <div className="table-footer">
            <select className="input w-auto text-[12px] py-1.5"><option>25 Per Page</option></select>
            <button className="btn-secondary" onClick={() => setView("tools")}>Back to Tools</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title"><Wrench size={19} className="text-[#3b4ef5]" /> Tools</h1>
      <p className="page-subtitle mb-6">Grow your contact base and engage with them using the tools below.</p>
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#7a85a8] mb-3">Audience Growth</h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.title} onClick={c.onClick} className={`tool-card group ${c.onClick ? "cursor-pointer" : ""}`}>
            <span className="tool-icon">{c.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#0f1b3d]">
                {c.title}
                {c.onClick && <ArrowUpRight size={13} className="text-[#9aa3c0] opacity-0 transition-opacity group-hover:opacity-100" />}
              </div>
              <div className="text-[12.5px] text-[#7a85a8] mt-1 leading-relaxed">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
