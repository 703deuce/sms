"use client";

import TransovoSidebar from "./components/TransovoSidebar";
import "./reference.css";

export default function ReferencePage() {
  return (
    <div className="flex h-screen bg-background">
      <TransovoSidebar defaultActiveId="inbox" />
      <main className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="flex h-[calc(100%-3rem)] w-[calc(100%-3rem)] items-center justify-center rounded-xl border-2 border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            Conversations page content goes here
          </p>
        </div>
      </main>
    </div>
  );
}
