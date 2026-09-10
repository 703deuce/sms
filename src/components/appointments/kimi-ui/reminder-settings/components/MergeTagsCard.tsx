import { ExternalLink } from 'lucide-react';

export default function MergeTagsCard({ tags }: { tags: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-[14px] font-semibold text-foreground">Merge tags</h3>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        Personalize your messages with dynamic information.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="rounded-md bg-[#eef2ff] px-2 py-1 text-[11.5px] font-medium text-[#147d74] transition-colors hover:bg-[#e0e7ff]"
          >
            {tag}
          </button>
        ))}
      </div>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#147d74] hover:underline"
      >
        View all tags <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
