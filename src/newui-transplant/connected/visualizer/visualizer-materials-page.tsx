"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

type Material = { id: string; name: string; category: string; sku: string | null; imageUrl: string };

export function VisualizerMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    fetch("/api/visualizer/materials")
      .then((r) => r.json())
      .then((d) => setMaterials(d.materials || []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">Products available in your remodel previews.</p>
        </div>
        <Button render={<Link href={VISUALIZER_ROUTES.materialNew} />}>
          <Plus className="size-4" aria-hidden />
          Add material
        </Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {materials.map((m) => (
          <Link key={m.id} href={VISUALIZER_ROUTES.material(m.id)} className={OPUS_CARD + " overflow-hidden"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.imageUrl} alt="" className="aspect-square w-full object-cover" />
            <div className="p-3">
              <p className="font-medium text-sm">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.category}{m.sku ? ` · ${m.sku}` : ""}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
