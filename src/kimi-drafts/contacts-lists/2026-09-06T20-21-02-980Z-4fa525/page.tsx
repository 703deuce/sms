"use client";

import { useCallback, useState } from "react";
import "./reference.css";
import Sidebar, { Page } from "./components/Sidebar";
import ListsPage from "./components/ListsPage";
import CreateListPage from "./components/CreateListPage";
import ContactsPage from "./components/ContactsPage";
import ToolsPage from "./components/ToolsPage";
import KeywordEditor from "./components/KeywordEditor";
import {
  initialLists, contacts as seedContacts, contactStats, initialKeywords,
  ContactList, Contact, Keyword,
} from "./mock-data";
import { CheckCircle2 } from "lucide-react";

export default function ReferencePage() {
  const [page, setPage] = useState<Page>("lists");
  const [lists, setLists] = useState<ContactList[]>(initialLists);
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const goToPage = useCallback((next: Page) => {
    setPage(next);
    if (next !== "contacts") setSelectedListId(null);
  }, []);

  const saveList = async (name: string, description: string) => {
    const newList: ContactList = {
      id: `l${Date.now()}`,
      name,
      description,
      created: "Just now",
      contacts: 0,
    };
    setLists((prev) => [...prev, newList]);
    goToPage("lists");
    showToast("List created.");
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (selectedListId === id) setSelectedListId(null);
    showToast("List deleted.");
  };

  const addToLists = (contactIds: string[], listIds: string[]) => {
    setLists((prev) =>
      prev.map((l) => (listIds.includes(l.id) ? { ...l, contacts: l.contacts + contactIds.length } : l)),
    );
    showToast("Contacts successfully added.");
  };

  const removeFromLists = (contactIds: string[], listIds: string[]) => {
    setLists((prev) =>
      prev.map((l) =>
        listIds.includes(l.id) ? { ...l, contacts: Math.max(0, l.contacts - contactIds.length) } : l,
      ),
    );
    showToast("Contacts removed from lists.");
  };

  const deleteContacts = (ids: string[]) => {
    setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
    showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} deleted.`);
  };

  const unsubscribeContacts = (ids: string[]) => {
    setContacts((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, optIn: "Unsubscribed" as const } : c)));
    showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} unsubscribed.`);
  };

  const saveKeyword = (payload: { listId: string | null; keyword: string; description: string; autoResponse: string; status: "Active" | "Inactive" }) => {
    if (!editingKeyword) {
      setPage("tools");
      return;
    }
    const listName = payload.listId ? lists.find((l) => l.id === payload.listId)?.name ?? "" : "";
    setKeywords((prev) =>
      prev.map((k) =>
        k.id === editingKeyword.id
          ? {
              ...k,
              keyword: payload.keyword,
              description: payload.description,
              autoResponse: payload.autoResponse,
              status: payload.status,
              listName,
              connectedLists: payload.listId ? Math.max(1, k.connectedLists) : 0,
              lastSaved: "Just now",
            }
          : k,
      ),
    );
    setEditingKeyword(null);
    setPage("tools");
    showToast("Keyword saved.");
  };

  const activeTab: "contacts" | "lists" | "tools" =
    page === "contacts" ? "contacts" : page === "tools" || page === "keyword" ? "tools" : "lists";
  const showTabs = page === "lists" || page === "contacts" || page === "tools";

  return (
    <div className="kimi-cl min-h-screen bg-[#f7f8fc] text-[#0f1b3d] flex">
      <Sidebar page={page} navigate={goToPage} />
      <main className="flex-1 min-w-0 px-8 pt-6 pb-16 max-w-[1160px]">
        {showTabs && (
          <div className="flex items-center border-b border-[#eceef5] mb-6 -mt-2" role="tablist">
            {(["contacts", "lists", "tools"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={activeTab === t}
                className={`tab-link ${activeTab === t ? "active" : ""}`}
                onClick={() => goToPage(t)}
              >
                {t === "contacts" ? "Contacts" : t === "lists" ? "Lists" : "Tools"}
              </button>
            ))}
          </div>
        )}

        {page === "lists" && (
          <ListsPage
            lists={lists}
            highlightListId={selectedListId}
            onCreate={() => goToPage("createList")}
            onOpenContacts={(id) => { setSelectedListId(id); setPage("contacts"); }}
            onDelete={deleteList}
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
            selectedListId={selectedListId}
            onClearListFilter={() => setSelectedListId(null)}
            onAddToLists={addToLists}
            onRemoveFromLists={removeFromLists}
            onDeleteContacts={deleteContacts}
            onUnsubscribeContacts={unsubscribeContacts}
          />
        )}

        {page === "tools" && (
          <ToolsPage
            keywords={keywords}
            onEditKeyword={(k) => { setEditingKeyword(k); setPage("keyword"); }}
            onCreateKeyword={() => showToast("Keyword creation requires a messaging number configured in Settings.")}
          />
        )}

        {page === "keyword" && editingKeyword && (
          <KeywordEditor
            lists={lists}
            keyword={editingKeyword}
            onSave={saveKeyword}
            onCancel={() => { setEditingKeyword(null); setPage("tools"); }}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={15} className="text-[#12b76a]" /> {toast}
        </div>
      )}
    </div>
  );
}
