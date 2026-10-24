import { getPrisma } from "../lib/server/db";

const ZZ_LIST_ID = "cmvkg4axh00brrv0lntc9pyml";
const TEST_PHONE_SUFFIXES = ["5555550101", "5555550103"];

async function main() {
  const prisma = getPrisma();
  const contacts = await prisma.contact.findMany({
    where: {
      OR: TEST_PHONE_SUFFIXES.map((s) => ({ phone: { contains: s } })),
    },
    select: { id: true, workspaceId: true, phone: true, firstName: true },
  });

  const contactIds = contacts.map((c) => c.id);
  let deletedMembers = 0;
  let deletedTags = 0;
  let deletedContacts = 0;

  if (contactIds.length > 0) {
    deletedMembers = (
      await prisma.contactListMember.deleteMany({
        where: { contactId: { in: contactIds } },
      })
    ).count;
    deletedTags = (
      await prisma.contactTag.deleteMany({
        where: { contactId: { in: contactIds } },
      })
    ).count;
    deletedContacts = (
      await prisma.contact.deleteMany({
        where: { id: { in: contactIds }, workspaceId: "ws_1" },
      })
    ).count;
  }

  const list = await prisma.contactList.findUnique({
    where: { id: ZZ_LIST_ID },
    select: { id: true, name: true },
  });

  let deletedList = 0;
  if (list) {
    await prisma.contactListMember.deleteMany({ where: { listId: ZZ_LIST_ID } });
    await prisma.contactList.delete({ where: { id: ZZ_LIST_ID } });
    deletedList = 1;
  }

  console.log(
    JSON.stringify({
      ok: true,
      contactsFound: contacts.length,
      deletedMembers,
      deletedTags,
      deletedContacts,
      deletedList,
      listWasPresent: Boolean(list),
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
