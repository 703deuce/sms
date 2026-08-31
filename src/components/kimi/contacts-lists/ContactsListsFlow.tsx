"use client";
import { useState } from "react";
import Sidebar, { Page } from "./components/Sidebar";
import ListsPage from "./components/ListsPage";
import CreateListPage from "./components/CreateListPage";
import ContactsPage from "./components/ContactsPage";
import KeywordEditor from "./components/KeywordEditor";
import { initialLists, contacts as mockContacts, keywords as mockKeywords, ContactList } from "./mock-data";
import { Wrench, LayoutTemplate, MonitorSmartphone, MessageSquareText, QrCode, MousePointerClick, Search, MoreVertical, CheckCircle2 } from "lucide-react";

/**
 * Kimi session 2026-08-31T00-27-02-830Z-a189c0 — UI from Kimi draft (mock data, no backend wiring yet).
 */
export default function ContactsListsFlow() {
  const [page, setPage] = useState<Page>("lists");
  const [lists, setLists] = useState<ContactList[]>(initialLists);
  const [keywords, setKeywords] = useState(mockKeywords);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const saveList = (name: string, description: string) => {
    setLists([{ id: String(Date.now()), name, description, created: "Sep 10th, 2024 @ 8:46 am", contacts: 0 }, ...lists]);
    setPage("lists");
    showToast("List created.");
  };

  const addToLists = (contactIds: string[], listIds: string[]) => {
    setLists(lists.map((l) => (listIds.includes(l.id) ? { ...l, contacts: l.contacts + contactIds.length } : l)));
    showToast("Contacts successfully added.");
  };

  const saveKeyword = (listId: string | null) => {
    setKeywords(keywords.map((k) => (k.id === "k5" ? { ...k, connectedLists: listId ? 1 : 0 } : k)));
    setPage("tools");
    showToast("Keyword saved.");
  };

  return (
    <div className="flex min-h-screen bg-[#fbfcfe] text-[#0f1b3d]">
      <Sidebar page={page} navigate={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === "lists" && <ListsPage lists={lists} onCreate={() => setPage("createList")} />}
        {page === "createList" && <CreateListPage onBack={() => setPage("lists")} onSave={saveList} />}
        {page === "contacts" && <ContactsPage contacts={mockContacts} lists={lists} onAddToLists={addToLists} />}
        {page === "tools" && <ToolsPage keywords={keywords} onEditKeyword={() => setPage("keyword")} />}
        {page === "keyword" && <KeywordEditor lists={lists} onSave={saveKeyword} onCancel={() => setPage("tools")} />}
      </main>
      {toast && (
        <div className="toast"><CheckCircle2 size={14} /> {toast}</div>
      )}
    </div>
  );
}

/* ---------- Tools page with Audience Growth cards + Keywords table ---------- */
import { Keyword } from "./mock-data";

function ToolsPage({ keywords, onEditKeyword }: { keywords: Keyword[]; onEditKeyword: () => void }) {
  const [view, setView] = useState<"tools" | "keywords">("tools");
  const cards = [
    { icon: <LayoutTemplate size={22} className="text-[#3b4ef5]" />, title: "Landing Pages", desc: "Build landing pages or embedded forms that collect contact data and opt people into your audience." },
    { icon: <MonitorSmartphone size={22} className="text-[#3b4ef5]" />, title: "Website Popups", desc: "Create fully branded website popups that capture visitor information and allow them to subscribe." },
    { icon: <MessageSquareText size={22} className="text-[#3b4ef5]" />, title: "Keywords", desc: "Establish keywords that users can text to join your lists or get automated replies.", onClick: () => setView("keywords") },
    { icon: <QrCode size={22} className="text-[#3b4ef5]" />, title: "QR Codes", desc: "Generate a QR Code that opens a new message with your keyword and number pre-filled or sends users to a destination of your choice." },
    { icon: <MousePointerClick size={22} className="text-[#3b4ef5]" />, title: "Tap-to-Join Links", desc: "Tap-to-join links open a new message with your keyword and number pre-filled, so the user can simply hit send to subscribe." },
  ];

  if (view === "keywords") {
    return (
      <div className="p-8 max-w-[1100px]">
        <div className="text-[11.5px] text-[#9aa3c0] mb-2">Tools / <span className="text-[#44507a]">Keywords</span></div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
              <MessageSquareText size={20} className="text-[#3b4ef5]" /> Keywords
            </h1>
            <p className="text-[13px] text-[#7a85a8] mt-0.5">View and manage all of your keywords.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input className="input pr-8 w-[200px]" placeholder="Search" />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            </div>
            <button className="btn-primary">Create Keyword</button>
          </div>
        </div>
        <div className="bg-white border border-[#eceef5] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1.6fr_220px_40px] px-5 py-3 text-[11px] font-semibold tracking-wide text-[#7a85a8] bg-[#fafbfe] border-b border-[#eceef5]">
            <span>KEYWORD</span><span>DESCRIPTION</span><span>CREATES CONTACTS</span><span></span>
          </div>
          {keywords.map((k) => (
            <div key={k.id} className="row-hover grid grid-cols-[1fr_1.6fr_220px_40px] items-center px-5 py-3.5 border-b border-[#f1f3f9] last:border-0">
              <div>
                <div className="text-[13.5px] font-semibold text-[#0f1b3d]">{k.keyword}</div>
                <div className="text-[11.5px] text-[#9aa3c0]">Last saved on {k.lastSaved}</div>
              </div>
              <div className="text-[13px] text-[#44507a]">{k.description}</div>
              <div className="flex items-center gap-3 justify-end">
                <span className="flex items-center gap-1.5 text-[12px] text-[#7a85a8]">
                  <span className="w-6 h-6 rounded-full bg-[#eef1fe] text-[#3b4ef5] text-[11px] font-bold flex items-center justify-center">{k.connectedLists}</span>
                  Connected List{k.connectedLists === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#e7f8f0] text-[#12b76a]">Yes</span>
              </div>
              <MoreVertical size={15} className="text-[#9aa3c0] cursor-pointer" onClick={k.id === "k5" ? onEditKeyword : undefined} />
            </div>
          ))}
          <div className="px-5 py-3 flex items-center justify-between">
            <select className="input w-auto text-[12px] py-1.5"><option>25 Per Page</option></select>
            <button className="btn-secondary" onClick={() => setView("tools")}>Back to Tools</button>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-[#7a85a8]">Tip: click the row menu on <b>NashVIP</b> to open the Edit Keyword screen.</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1100px]">
      <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
        <Wrench size={20} className="text-[#3b4ef5]" /> Tools
      </h1>
      <p className="text-[13px] text-[#7a85a8] mt-0.5 mb-6">Grow your contact base and engage with them using the tools below.</p>
      <h2 className="text-[14px] font-bold text-[#0f1b3d] mb-4">Audience Growth</h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            onClick={c.onClick}
            className={`bg-white border border-[#eceef5] rounded-xl p-5 flex gap-4 items-start transition-shadow hover:shadow-md ${c.onClick ? "cursor-pointer" : ""}`}
          >
            <span className="w-11 h-11 rounded-xl bg-[#eef1fe] flex items-center justify-center shrink-0">{c.icon}</span>
            <div>
              <div className="text-[14px] font-bold text-[#0f1b3d]">{c.title}</div>
              <div className="text-[12.5px] text-[#7a85a8] mt-1 leading-relaxed">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
