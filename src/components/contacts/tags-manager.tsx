"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Tag, TagIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { contactTabs } from "@/lib/contact-tabs";

type TagRow = {
  id: string;
  name: string;
  contactCount: number;
};

type Props = {
  tags: TagRow[];
};

export function TagsManager({ tags: initialTags }: Props) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sortedTags = [...tags].sort((a, b) => b.contactCount - a.contactCount);
  const totalTagged = tags.reduce((sum, tag) => sum + tag.contactCount, 0);

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/contacts/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create tag");
      setTags((prev) => [...prev, { id: json.data.id, name: json.data.name, contactCount: 0 }]);
      setNewName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function renameTag(id: string, currentName: string) {
    const name = prompt("Tag name", currentName);
    if (!name?.trim() || name.trim().toLowerCase() === currentName) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/contacts/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to rename tag");
      setTags((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: json.data.name } : t)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTag(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"? This removes the tag from all contacts.`)) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/contacts/tags?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete tag");
      setTags((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Label contacts for filtering, automations, and inbox organization."
        actions={
          <Button type="button" onClick={() => document.getElementById("new-tag")?.focus()}>
            <Tag className="h-4 w-4" />
            Create tag
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tags" value={formatNumber(tags.length)} />
        <StatCard
          label="Tagged instances"
          value={formatNumber(totalTagged)}
          hint="Contacts can have multiple tags"
        />
        <StatCard
          label="Most used"
          value={sortedTags[0]?.name ?? "—"}
          hint={`${formatNumber(sortedTags[0]?.contactCount ?? 0)} contacts`}
        />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-tag" className="mb-1.5 block text-sm font-medium">
              New tag name
            </label>
            <Input
              id="new-tag"
              name="name"
              placeholder="e.g. vip-customer"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createTag();
                }
              }}
            />
          </div>
          <Button type="button" disabled={creating || !newName.trim()} onClick={createTag}>
            {creating ? "Adding…" : "Add tag"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </Card>

      {tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-10 w-10" />}
          title="No tags yet"
          description="Create tags to label and filter contacts across campaigns and inbox."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
              >
                <TagIcon className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{tag.name}</span>
                <span className="text-muted-foreground">{formatNumber(tag.contactCount)}</span>
              </span>
            ))}
          </div>

          <Card>
            <CardTitle>Tag management</CardTitle>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Tag</TH>
                  <TH>Contacts</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {tags.map((tag) => (
                  <TR key={tag.id}>
                    <TD>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {tag.name}
                      </span>
                    </TD>
                    <TD>{formatNumber(tag.contactCount)}</TD>
                    <TD>
                      <div className="flex gap-1">
                        <Link href="/contacts">
                          <Button variant="ghost" size="sm">View contacts</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={busyId === tag.id}
                          onClick={() => renameTag(tag.id, tag.name)}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="text-danger"
                          disabled={busyId === tag.id}
                          onClick={() => deleteTag(tag.id, tag.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
