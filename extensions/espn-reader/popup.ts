export {};
const status = document.querySelector("[role=status]");
function show(text: string) { if (status) status.textContent = text; }
void chrome.storage.session.get("status").then((data) => { if (typeof data.status === "string") show(data.status); });
chrome.storage.onChanged.addListener((changes) => { if (typeof changes.status?.newValue === "string") show(changes.status.newValue); });
document.querySelector("#open")?.addEventListener("click", () => {
  show("Connecting…");
  void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) =>
    chrome.runtime.sendMessage({ type: "open-assistant", tabId: tab?.id })
  ).catch(() => show("Open ESPN Reader again to retry."));
});
