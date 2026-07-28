/**
 * Seed script for Postgres. Run after migrate:
 *   npx tsx prisma/seed.ts
 *
 * Demo UI works from src/lib/mock/data.ts without seeding.
 */
import { PrismaClient, Role, ContactStatus, CampaignStatus, FlowStatus, ComplianceStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email: "alex@harborhome.co" },
    update: {},
    create: {
      email: "alex@harborhome.co",
      name: "Alex Rivera",
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "harbor-home" },
    update: {},
    create: {
      name: "Harbor Home Services",
      slug: "harbor-home",
      memberships: {
        create: { userId: user.id, role: Role.OWNER },
      },
      phoneNumbers: {
        create: [
          {
            e164: "+14155550142",
            type: "Local",
            areaCode: "415",
            friendlyName: "Main Sales",
            a2pStatus: ComplianceStatus.PENDING,
            messagingService: "Harbor Messaging",
            monthlyCostCents: 115,
            status: "Active",
          },
        ],
      },
      brand: {
        create: {
          legalName: "Harbor Home Services LLC",
          dba: "Harbor Home",
          website: "https://harborhome.example",
          status: ComplianceStatus.PENDING,
        },
      },
      complianceCampaign: {
        create: {
          useCase: "Customer care",
          description: "Appointment reminders and service updates",
          optInMethod: "Web form",
          status: ComplianceStatus.DRAFT,
          samples: [
            "Hi {{first_name}}, reminder about your appointment tomorrow.",
            "Thanks for choosing Harbor Home. Reply STOP to opt out.",
          ],
        },
      },
    },
  });

  const existingContacts = await prisma.contact.count({ where: { workspaceId: workspace.id } });
  if (existingContacts === 0) {
    await prisma.contact.createMany({
      data: [
        {
          workspaceId: workspace.id,
          firstName: "Maya",
          lastName: "Chen",
          phone: "+14155550101",
          email: "maya.chen@email.com",
          status: ContactStatus.SUBSCRIBED,
          consentSource: "Web form",
          consentDate: new Date("2026-03-12"),
        },
        {
          workspaceId: workspace.id,
          firstName: "Luis",
          lastName: "Ortiz",
          phone: "+14155550122",
          email: "luis@ortizco.com",
          status: ContactStatus.SUBSCRIBED,
          consentSource: "Keyword JOIN",
          consentDate: new Date("2026-05-02"),
        },
      ],
    });
  }

  const existingCampaigns = await prisma.campaign.count({ where: { workspaceId: workspace.id } });
  if (existingCampaigns === 0) {
    await prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: "July Service Special",
        type: "Promotion",
        audience: "Customers",
        body: "Harbor Home: Book your July tune-up and save 15%. Reply STOP to opt out.",
        status: CampaignStatus.COMPLETED,
        sent: 1204,
        delivered: 1178,
        replies: 142,
        clicks: 286,
        optOuts: 7,
        costCents: 1806,
        createdBy: "Sam Patel",
        scheduledAt: new Date("2026-07-20T10:00:00Z"),
      },
    });
  }

  const existingFlows = await prisma.automationFlow.count({ where: { workspaceId: workspace.id } });
  if (existingFlows === 0) {
    await prisma.automationFlow.create({
      data: {
        workspaceId: workspace.id,
        name: "Welcome series",
        trigger: "Contact joins list",
        definition: { nodes: [{ type: "trigger" }, { type: "send_sms" }] },
        enrolled: 842,
        messagesSent: 1640,
        completionRate: 78,
        status: FlowStatus.ACTIVE,
      },
    });
  }

  console.log("Seeded workspace:", workspace.slug, "user:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
