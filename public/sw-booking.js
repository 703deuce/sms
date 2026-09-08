self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", () => {
  // Network-first booking shell — offline fallback can be added later.
});
