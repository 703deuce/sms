import { permanentRedirect } from "next/navigation";

/** Preserve old streaming bookmarks while the canonical route is /app/streamer. */
export default function LegacyStreamingPage() {
  permanentRedirect("/app/streamer");
}
