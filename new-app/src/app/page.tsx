import { appInfo } from "@/lib/app-info";

export default function HomePage() {
  return (
    <main className="page">
      <h1>{appInfo.name}</h1>
      <p className="lede">
        This Next.js app is isolated from the legacy SMS platform at the
        repository root. Develop from <code>new-app/</code> only.
      </p>
      <ul className="checks">
        <li>Own <code>package.json</code> and lockfile</li>
        <li>Own <code>src/app</code> routing tree</li>
        <li>No imports from root <code>src/</code> or legacy layouts</li>
      </ul>
      <p className="meta">
        Environment: <strong>{appInfo.nodeEnv}</strong>
      </p>
    </main>
  );
}
