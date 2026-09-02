import { redirect } from "next/navigation";

/** Legacy create URL → in-app create flow on lists page. */
export default function CreateContactListAliasPage() {
  redirect("/contacts/lists?create=1");
}
