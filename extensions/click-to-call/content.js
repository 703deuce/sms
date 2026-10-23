import { findPhoneNumbersInText, normalizeDigits } from "./phone-detect.js";

const ATTR = "data-transovo-click-to-call";

function decorateNode(node) {
  if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(`[${ATTR}]`) || parent.closest("a,button,input,textarea,script,style")) return;
  const phones = findPhoneNumbersInText(node.textContent);
  if (!phones.length) return;
  const text = node.textContent;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const raw of phones) {
    const idx = text.indexOf(raw, last);
    if (idx < 0) continue;
    if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute(ATTR, normalizeDigits(raw));
    btn.textContent = raw;
    btn.className = "transovo-ctc-link";
    btn.style.cssText = "border:none;background:transparent;color:#2563eb;text-decoration:underline;cursor:pointer;padding:0;font:inherit";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "click_to_call", phoneE164: btn.getAttribute(ATTR) });
    });
    frag.appendChild(btn);
    last = idx + raw.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  parent.replaceChild(frag, node);
}

function scan(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(decorateNode);
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) scan(n);
    });
  }
});

scan();
observer.observe(document.body, { childList: true, subtree: true });
