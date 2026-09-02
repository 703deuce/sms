import { redirect } from "next/navigation";

/** Legacy create URL → in-app create flow on lists page. */
export default function CreateContactListLegacyPage() {
  redirect("/contacts/lists?create=1");
}
