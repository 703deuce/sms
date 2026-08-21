import { redirect } from "next/navigation";

/** Legacy launcher path — keep working for bookmarks and older deploy links. */
export default function LegacyReceptionistLauncherPage() {
  redirect("/api/products/open?product=voice");
}
