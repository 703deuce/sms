import { NextResponse } from "next/server";

/** Microsoft Entra publisher domain verification for Transovo Calendar Integration. */
const MICROSOFT_IDENTITY_ASSOCIATION = {
  associatedApplications: [
    {
      applicationId: "22629b27-002a-4008-9e75-05cc38a21155",
    },
  ],
};

export async function GET() {
  return NextResponse.json(MICROSOFT_IDENTITY_ASSOCIATION, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
