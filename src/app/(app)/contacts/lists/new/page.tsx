import { redirect } from "next/navigation";

/** Legacy / bookmarked create URL → in-app create flow on lists page. */
export default function CreateContactListPage() {
  redirect("/contacts/lists?create=1");
}
