import { Suspense } from "react";
import NotetakerHome from "./components/NotetakerHome";
import "./reference.css";

export default function ReferencePage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1024, margin: "0 auto", padding: 24 }}>
          <div className="skeleton" style={{ height: 28, width: 220 }} />
          <div className="skeleton" style={{ height: 14, width: 420, marginTop: 10 }} />
          <div className="skeleton" style={{ height: 120, marginTop: 24 }} />
        </div>
      }
    >
      <NotetakerHome />
    </Suspense>
  );
}
