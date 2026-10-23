const fields = ["apiBaseUrl", "apiKey", "sessionId", "contactId"];

document.getElementById("save").addEventListener("click", () => {
  const data = {};
  for (const id of fields) {
    data[id] = document.getElementById(id).value.trim();
  }
  chrome.storage.sync.set(data, () => {
    document.getElementById("status").textContent = "Saved.";
  });
});

chrome.storage.sync.get(fields, (cfg) => {
  for (const id of fields) {
    document.getElementById(id).value = cfg[id] || "";
  }
});
