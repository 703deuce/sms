/**
 * Backend adapter shell for Kimi contacts-lists.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/kimi/contacts-lists/components/Sidebar";
import ListsPage from "@/components/kimi/contacts-lists/components/ListsPage";
import CreateListPage from "@/components/kimi/contacts-lists/components/CreateListPage";
import ContactsPage from "@/components/kimi/contacts-lists/components/ContactsPage";
import KeywordEditor from "@/components/kimi/contacts-lists/components/KeywordEditor";
import type { ContactList, Contact, Keyword } from "@/components/kimi/contacts-lists/mock-data";
import {
  addContactsToList,
  createList,
  deleteList,
  fetchContactsForLists,
  fetchKeywordsForLists,
  fetchLists,
  removeContactsFromLists,
  updateKeywordForList,
} from "@/lib/contacts/kimi-lists-adapter";
import {
  deleteContacts,
  fetchContactStats,
  updateContact,
  type KimiContactStats,
} from "@/lib/contacts/kimi-contacts-adapter";
import {
  Users, ListTodo, Wrench, LayoutTemplate, MonitorSmartphone, MessageSquareText,
  QrCode, MousePointerClick, Search, MoreVertical, CheckCircle2, ArrowUpRight,
} from "lucide-react";

export function KimiListsConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editKeywordId = searchParams.get("editKeyword");
  const createRequested = searchParams.get("create") === "1";
  const highlightListId = searchParams.get("listId");
  const [page, setPage] = useState<Page>(createRequested ? "createList" : "lists");
  const [lists, setLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [contactStats, setContactStats] = useState<KimiContactStats>({
    contacts: 0,
    subscribed: 0,
    unsubscribed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearKeywordEditParam = useCallback(() => {
    if (!searchParams.get("editKeyword")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("editKeyword");
    const qs = next.toString();
    router.replace(qs ? `/contacts/lists?${qs}` : "/contacts/lists");
  }, [router, searchParams]);

  const reload = useCallback(async () => {
    const [l, c, k, stats] = await Promise.all([
      fetchLists(),
      fetchContactsForLists(),
      fetchKeywordsForLists(),
      fetchContactStats().catch(() => ({ contacts: 0, subscribed: 0, unsubscribed: 0 })),
    ]);
    setLists(l);
    setContacts(c);
    setKeywords(k);
    setContactStats(stats);
  }, []);

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load lists"))
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (createRequested) {
      setPage("createList");
    }
  }, [createRequested]);

  useEffect(() => {
    if (!editKeywordId || keywords.length === 0) return;
    const kw = keywords.find((k) => k.id === editKeywordId);
    if (!kw) return;
    setEditingKeyword(kw);
    setPage("keyword");
  }, [editKeywordId, keywords]);

  const goToPage = useCallback(
    (next: Page) => {
      setPage(next);
      if (next === "createList") {
        router.replace("/contacts/lists?create=1");
        return;
      }
      if (next === "lists") {
        router.replace("/contacts/lists");
        return;
      }
      router.replace("/contacts/lists");
    },
    [router],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const saveList = async (name: string, description: string) => {
    setError("");
    try {
      await createList(name, description);
      await reload();
      goToPage("lists");
      showToast("List created.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create list";
      setError(message);
      throw err;
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
    status: "Active" | "Inactive";
  }) => {
    if (!editingKeyword) {
      setPage("tools");
      return;
    }
    setError("");
    try {
      const listName = payload.listId ? lists.find((l) => l.id === payload.listId)?.name : "";
      await updateKeywordForList(editingKeyword.id, {
        keyword: payload.keyword,
        listName: listName || undefined,
        confirmation: payload.description,
        autoReply: payload.autoResponse,
        status: payload.status,
      });
      await reload();
      setPage("tools");
      setEditingKeyword(null);
      clearKeywordEditParam();
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
            <button className={`page-tab ${activeTab === "contacts" ? "active" : ""}`} onClick={() => goToPage("contacts")}>
              <Users size={14} /> Contacts
            </button>
            <button className={`page-tab ${activeTab === "lists" ? "active" : ""}`} onClick={() => goToPage("lists")}>
              <ListTodo size={14} /> Lists
            </button>
            <button className={`page-tab ${activeTab === "tools" ? "active" : ""}`} onClick={() => goToPage("tools")}>
              <Wrench size={14} /> Tools
            </button>
          </div>
        )}
        {page === "lists" && (
          <ListsPage
            lists={lists}
            highlightListId={highlightListId}
            onCreate={() => goToPage("createList")}
            onDelete={async (id) => {
              await deleteList(id);
              await reload();
              showToast("List deleted.");
            }}
          />
        )}
        {page === "createList" && (
          <CreateListPage onBack={() => goToPage("lists")} onSave={saveList} />
        )}
        {page === "contacts" && (
          <ContactsPage
            contacts={contacts}
            lists={lists}
            stats={contactStats}
            onAddToLists={addToLists}
            onRemoveFromLists={async (contactIds, listIds) => {
              await removeContactsFromLists(listIds, contactIds);
              await reload();
              showToast("Contacts removed from lists.");
            }}
            onDeleteContacts={async (ids) => {
              await deleteContacts(ids);
              await reload();
              showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} deleted.`);
            }}
            onUnsubscribeContacts={async (ids) => {
              await Promise.all(ids.map((id) => updateContact(id, { optInLabel: "Unsubscribed" })));
              await reload();
              showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} unsubscribed.`);
            }}
          />
        )}
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
            initialListName={editingKeyword.listName}
            initialStatus={editingKeyword.status}
            onSave={(payload) => void saveKeyword(payload)}
            onCancel={() => {
              setEditingKeyword(null);
              setPage("tools");
              clearKeywordEditParam();
            }}
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
  const [search, setSearch] = useState("");
  const cards = [
    { icon: <LayoutTemplate size={19} />, title: "Landing Pages", desc: "Build landing pages or embedded forms that collect contact data and opt people into your audience.", href: "/grow/forms" },
    { icon: <MonitorSmartphone size={19} />, title: "Website Popups", desc: "Create fully branded website popups that capture visitor information and allow them to subscribe.", href: "/grow/forms" },
    { icon: <MessageSquareText size={19} />, title: "Keywords", desc: "Establish keywords that users can text to join your lists or get automated replies.", onClick: () => setView("keywords") },
    { icon: <QrCode size={19} />, title: "QR Codes", desc: "Generate a QR Code that opens a new message with your keyword and number pre-filled or sends users to a destination of your choice.", href: "/grow/qr-codes" },
    { icon: <MousePointerClick size={19} />, title: "Tap-to-Join Links", desc: "Tap-to-join links open a new message with your keyword and number pre-filled, so the user can simply hit send to subscribe.", href: "/grow/tap-to-join" },
  ];

  if (view === "keywords") {
    const filteredKeywords = keywords.filter((k) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${k.keyword} ${k.description}`.toLowerCase().includes(q);
    });

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
              <input
                className="input pl-8 w-[220px]"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={() => window.location.assign("/grow/keywords")}>Create Keyword</button>
          </div>
        </div>
        <div className="table-card">
          <div className="table-head grid grid-cols-[1fr_1.6fr_120px_120px_40px]">
            <span>KEYWORD</span><span>DESCRIPTION</span><span className="text-right">STATUS</span><span className="text-right">LISTS</span><span></span>
          </div>
          {filteredKeywords.map((k) => (
            <div key={k.id} className="table-row grid grid-cols-[1fr_1.6fr_120px_120px_40px]">
              <div>
                <div className="cell-primary">{k.keyword}</div>
                <div className="cell-sub">Last saved on {k.lastSaved}</div>
              </div>
              <div className="cell-body">{k.description}</div>
              <div className="flex justify-end">
                <span className={`pill ${k.status === "Inactive" ? "pill-gray" : "pill-green"}`}>
                  {k.status || "Active"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 justify-end text-[12px] text-[#7a85a8]">
                <span className="count-badge">{k.connectedLists}</span>
                Connected
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
          <div
            key={c.title}
            onClick={() => {
              if (c.onClick) c.onClick();
              else if (c.href) window.location.assign(c.href);
            }}
            className={`tool-card group ${c.onClick || c.href ? "cursor-pointer" : ""}`}
          >
            <span className="tool-icon">{c.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#0f1b3d]">
                {c.title}
                {(c.onClick || c.href) && <ArrowUpRight size={13} className="text-[#9aa3c0] opacity-0 transition-opacity group-hover:opacity-100" />}
              </div>
              <div className="text-[12.5px] text-[#7a85a8] mt-1 leading-relaxed">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
