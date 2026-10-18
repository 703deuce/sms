import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function commitSha(): string | null {
  return (
    process.env.SOURCE_COMMIT?.trim() ||
    process.env.COOLIFY_BRANCH_COMMIT?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    null
  );
}

export async function GET() {
  let version = process.env.npm_package_version ?? "0.1.0";
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    version = pkg.version ?? version;
  } catch {
    // ignore
  }

  return Response.json({
    ok: true,
    app: "transovo-new-app",
    version,
    commitSha: commitSha(),
  });
}
