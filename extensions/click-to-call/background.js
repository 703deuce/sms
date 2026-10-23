chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "click_to_call") return;
  chrome.storage.sync.get(["apiBaseUrl", "apiKey", "sessionId", "contactId"], async (cfg) => {
    const base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
    const key = cfg.apiKey || "";
    const sessionId = cfg.sessionId || "";
    if (!base || !key || !sessionId) {
      sendResponse({ ok: false, error: "Configure API base URL, key, and session ID in extension options." });
      return;
    }
    try {
      const res = await fetch(`${base}/api/v1/power-dialer/click-to-call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          contactId: cfg.contactId || undefined,
          phoneE164: msg.phoneE164,
        }),
      });
      const json = await res.json();
      sendResponse({ ok: res.ok, body: json });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : "request_failed" });
    }
  });
  return true;
});
