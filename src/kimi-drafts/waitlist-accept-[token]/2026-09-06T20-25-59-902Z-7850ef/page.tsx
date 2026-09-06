import { PublicWaitlistAcceptClient } from "./components/PublicWaitlistAcceptClient";
import "./reference.css";

// Sandbox stand-in for /waitlist/accept/[token].
// In production the token arrives via route params; here we expose a
// demo token. Include "expired" or "invalid" in the token to preview
// the unavailable-offer state, or "network" to preview the retryable
// connection-failure state.
const DEMO_TOKEN = "wl_demo_9f3k2";

export default function WaitlistAcceptPage() {
  return <PublicWaitlistAcceptClient token={DEMO_TOKEN} />;
}
