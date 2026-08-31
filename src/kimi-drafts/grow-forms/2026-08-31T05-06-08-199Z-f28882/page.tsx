"use client";

import { useState } from "react";
import "./reference.css";
import WebFormsList from "./components/WebFormsList";
import FormBuilder from "./components/FormBuilder";
import FormCreatedModal from "./components/FormCreatedModal";
import { FormPreview, EmbedSitePreview } from "./components/FormPreview";
import { WebForm, builderDefaults } from "./mock-data";

export type View =
  | { kind: "list" }
  | { kind: "builder"; formType: "landing" | "embed"; editId?: string }
  | { kind: "preview" }
  | { kind: "embed-site" };

export type SavedForm = {
  type: "landing" | "embed";
  name: string;
  url?: string;
  embedCode?: string;
};

export default function ReferencePage() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [forms, setForms] = useState<WebForm[]>([]);
  const [saved, setSaved] = useState<SavedForm | null>(null);

  const baseList: WebForm[] = [
    // rows below mirror the video list
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ...(require("./mock-data").webForms as WebForm[]),
    ...forms,
  ];

  const handleSave = (type: "landing" | "embed", name: string, description: string, urlPath: string) => {
    const s: SavedForm =
      type === "landing"
        ? { type, name, url: `https://tvforms.co/${urlPath || "signup"}` }
        : {
            type,
            name,
            embedCode: `<script async\n  src="https://static.transovo.com/formscripts/embed/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.zGMnMDMOMDNjY3OTQzZmN4NTE3MGNhZ2fQ">\n</script>`,
          };
    setSaved(s);
    setForms((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name,
        description,
        type: type === "landing" ? "Landing Page" : "Website Embed",
        lists: 1,
        status: "Active",
        lastSaved: "Just now",
        thumb: type === "landing" ? "#2f4a37" : "#0a0a0a",
      },
    ]);
  };

  return (
    <div className="ref-root">
      {view.kind === "list" && (
        <WebFormsList
          forms={baseList}
          onCreate={() => setView({ kind: "builder", formType: "landing" })}
          onEdit={(f) => setView({ kind: "builder", formType: f.type === "Landing Page" ? "landing" : "embed", editId: f.id })}
          onDelete={(id) => setForms((p) => p.filter((x) => x.id !== id))}
        />
      )}

      {view.kind === "builder" && (
        <FormBuilder
          formType={view.formType}
          onBack={() => setView({ kind: "list" })}
          onSave={handleSave}
          onPreview={() => setView({ kind: "preview" })}
          onPreviewEmbedSite={() => setView({ kind: "embed-site" })}
          showCreated={!!saved}
          onCloseCreated={() => setSaved(null)}
          saved={saved}
        />
      )}

      {view.kind === "preview" && (
        <FormPreview
          heading={builderDefaults.landing.heading}
          subheading={builderDefaults.landing.subheading}
          onExit={() => setView({ kind: "builder", formType: "landing" })}
        />
      )}

      {view.kind === "embed-site" && (
        <EmbedSitePreview onExit={() => setView({ kind: "builder", formType: "embed" })} />
      )}
    </div>
  );
}
