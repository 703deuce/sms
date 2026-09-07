/**
 * Kimi session 2026-08-31T00-27-02-830Z-a189c0 — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import { useState } from "react";
import { Page } from "./components/Sidebar";
import ListsPage from "./components/ListsPage";
import CreateListPage from "./components/CreateListPage";
import ContactsPage from "./components/ContactsPage";
import KeywordEditor from "./components/KeywordEditor";
import { initialLists, contacts as mockContacts, keywords as mockKeywords, contactStats, ContactList, Keyword } from "./mock-data";
import {
  Users,
  ListTodo,
  Wrench,
  LayoutTemplate,
  MonitorSmartphone,
  MessageSquareText,
  QrCode,
  MousePointerClick,
  Search,
  MoreVertical,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

export default function ContactsListsFlow() {
  const [page, setPage] = useState<Page>("lists");
  const [lists, setLists] = useState<ContactList[]>(initialLists);
  const [keywords, setKeywords] = useState(mockKeywords);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const saveList = async (name: string, description: string) => {
    setLists([{ id: String(Date.now()), name, description, created: "Sep 10th, 2024 @ 8:46 am", contacts: 0 }, ...lists]);
    setPage("lists");
    showToast("List created.");
  };

  const addToLists = (contactIds: string[], listIds: string[]) => {
    setLists(lists.map((l) => (listIds.includes(l.id) ? { ...l, contacts: l.contacts + contactIds.length } : l)));
    showToast("Contacts successfully added.");
  };

  const saveKeyword = (_payload: {
    listId: string | null;
    keyword: string;
    description: string;
    autoResponse: string;
    status: "Active" | "Inactive";
  }) => {
    setKeywords(keywords.map((k) => (k.id === "k5" ? { ...k, connectedLists: _payload.listId ? 1 : 0 } : k)));
    setPage("tools");
    showToast("Keyword saved.");
  };

  const activeTab: "contacts" | "lists" | "tools" =
    page === "contacts" ? "contacts" : page === "tools" || page === "keyword" ? "tools" : "lists";

  const showTabs = page === "lists" || page === "contacts" || page === "tools";

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#0f1b3d]">
      <main className="mx-auto max-w-[1160px] px-8 pb-16">
        {showTabs && (
          <div className="page-tabs mb-7">
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
        {page === "contacts" && (
          <ContactsPage
            contacts={mockContacts}
            lists={lists}
            stats={{ contacts: contactStats.total, subscribed: contactStats.subscribed, unsubscribed: contactStats.unsubscribed }}
            onAddToLists={addToLists}
          />
        )}
        {page === "tools" && <ToolsPage keywords={keywords} onEditKeyword={() => setPage("keyword")} />}
        {page === "keyword" && <KeywordEditor lists={lists} onSave={saveKeyword} onCancel={() => setPage("tools")} />}
      </main>
      {toast && (
        <div className="toast fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-[#0f1b3d] px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-[#0f1b3d]/20 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={14} className="text-[#12b76a]" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Tools page with Audience Growth cards + Keywords table ---------- */

function ToolsPage({ keywords, onEditKeyword }: { keywords: Keyword[]; onEditKeyword: () => void }) {
  const [view, setView] = useState<"tools" | "keywords">("tools");
  const cards = [
    { icon: <LayoutTemplate size={18} />, title: "Landing Pages", desc: "Build landing pages or embedded forms that collect contact data and opt people into your audience." },
    { icon: <MonitorSmartphone size={18} />, title: "Website Popups", desc: "Create fully branded website popups that capture visitor information and allow them to subscribe." },
    { icon: <MessageSquareText size={18} />, title: "Keywords", desc: "Establish keywords that users can text to join your lists or get automated replies.", onClick: () => setView("keywords") },
    { icon: <QrCode size={18} />, title: "QR Codes", desc: "Generate a QR Code that opens a new message with your keyword and number pre-filled or sends users to a destination of your choice." },
    { icon: <MousePointerClick size={18} />, title: "Tap-to-Join Links", desc: "Tap-to-join links open a new message with your keyword and number pre-filled, so the user can simply hit send to subscribe." },
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
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
              <input className="input pl-8 w-[220px]" placeholder="Search" />
            </div>
            <button className="btn-primary">Create Keyword</button>
          </div>
        </div>
        <div className="table-card">
          <div className="table-head grid grid-cols-[1fr_1.6fr_220px_40px]">
            <span>KEYWORD</span><span>DESCRIPTION</span><span className="text-right">CREATES CONTACTS</span><span></span>
          </div>
          {keywords.map((k) => (
            <div key={k.id} className="table-row grid grid-cols-[1fr_1.6fr_220px_40px] transition-colors hover:bg-[#fafbfe]">
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
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] transition-colors hover:bg-[#eef1fe] hover:text-[#3b4ef5]" onClick={k.id === "k5" ? onEditKeyword : undefined}>
                <MoreVertical size={15} />
              </button>
            </div>
          ))}
          <div className="table-footer">
            <select className="input w-auto text-[12px] py-1.5"><option>25 Per Page</option></select>
            <button className="btn-secondary" onClick={() => setView("tools")}>Back to Tools</button>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-[#7a85a8]">Tip: click the row menu on <span className="font-semibold text-[#44507a]">NashVIP</span> to open the Edit Keyword screen.</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title"><Wrench size={19} className="text-[#3b4ef5]" /> Tools</h1>
      <p className="page-subtitle mb-7">Grow your contact base and engage with them using the tools below.</p>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7a85a8]">Audience Growth</h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            onClick={c.onClick}
            className={`tool-card group transition-all duration-150 ${c.onClick ? "cursor-pointer hover:border-[#3b4ef5]/40 hover:shadow-md" : ""}`}
          >
            <span className="tool-icon transition-colors group-hover:bg-[#e3e8fd] group-hover:text-[#3b4ef5]">{c.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#0f1b3d]">
                {c.title}
                {c.onClick && <ArrowUpRight size={13} className="text-[#9aa3c0] opacity-0 transition-opacity group-hover:opacity-100" />}
              </div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-[#7a85a8]">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
