self.addEventListener("push", (event) => {
  let data = {
    title: "Transovo AI",
    body: "New notification",
    url: "/inbox",
    tag: "transovo",
    kind: "general",
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // keep defaults
  }

  const isCall = data.kind === "incoming_call" || (data.tag || "").startsWith("incoming-call");
  const options = {
    body: data.body,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: data.tag || (isCall ? "incoming-call" : "transovo"),
    renotify: Boolean(isCall),
    requireInteraction: Boolean(data.requireInteraction || isCall),
    data: {
      url: data.url || (isCall ? "/phone" : "/inbox"),
      kind: data.kind || "general",
      humanCallId: data.humanCallId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/inbox";
  const humanCallId = event.notification.data?.humanCallId;
  const target =
    humanCallId && url.indexOf("incoming=") === -1
      ? `${url}${url.indexOf("?") >= 0 ? "&" : "?"}incoming=${encodeURIComponent(humanCallId)}`
      : url;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({
            type: "incoming_call_click",
            humanCallId,
            url: target,
          });
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
