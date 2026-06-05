/* ==========================================================================
   popup.js
   Quick-access popup logic:
     • "Freeze current window"  → snapshot all tabs of the current window
     • "Open full dashboard"    → open dashboard.html in a new tab
     • Recent sessions (3)      → one-click restore
   Uses async/await with the chrome.* promise APIs. No inline handlers (CSP).
   ========================================================================== */

"use strict";

/** URL schemes the browser refuses to (re)open via tabs.create — skip them. */
const UNSUPPORTED_SCHEMES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
];

function isRestorable(url) {
  if (!url) return false;
  return !UNSUPPORTED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

/** Map raw chrome tabs into the lightweight shape we persist. */
function mapTabs(tabs) {
  return tabs
    .filter((t) => t.url) // ignore tabs without a URL (e.g. still loading)
    .map((t) => ({
      url: t.url,
      title: t.title || t.url,
      favIconUrl: t.favIconUrl || "",
    }));
}

/* ----------------------------- Actions ---------------------------------- */

/** Snapshot the current window's tabs into a new named session. */
async function freezeCurrentWindow() {
  // Get every tab that belongs to the window the popup was opened from.
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const mapped = mapTabs(tabs);

  if (mapped.length === 0) {
    DWMUI.toast(DWMi18n.t("toast_no_tabs"), { danger: true });
    return;
  }

  const nameInput = document.getElementById("sessionName");
  await DWMStore.addSession(nameInput.value, mapped);

  nameInput.value = "";
  DWMUI.toast(DWMi18n.t("toast_saved"));
  await renderRecent();
}

/** Open every restorable URL of a session as new tabs. */
async function restoreSession(session) {
  if (!session || !Array.isArray(session.tabs)) return;
  DWMUI.toast(DWMi18n.t("toast_restoring"));

  for (const tab of session.tabs) {
    if (!isRestorable(tab.url)) continue;
    // active:false keeps focus stable while many tabs open.
    await chrome.tabs.create({ url: tab.url, active: false });
  }
}

/** Open the full dashboard page in a dedicated tab. */
async function openDashboard() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  window.close();
}

/* ----------------------------- Rendering -------------------------------- */

/** Render the 3 most recent sessions with one-click restore buttons. */
async function renderRecent() {
  const list = document.getElementById("recentList");
  const sessions = await DWMStore.getSessions();
  list.innerHTML = "";

  if (sessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dwm-empty";
    empty.textContent = DWMi18n.t("empty_recent");
    list.appendChild(empty);
    return;
  }

  sessions.slice(0, 3).forEach((session) => {
    const card = document.createElement("div");
    card.className = "dwm-panel dwm-enter p-2 d-flex align-items-center gap-2";

    const info = document.createElement("div");
    info.className = "flex-grow-1 overflow-hidden";

    const name = document.createElement("div");
    name.className = "dwm-tab-title fw-semibold";
    name.textContent = session.name;

    const meta = document.createElement("div");
    meta.className = "dwm-chip is-cyan mt-1";
    meta.textContent = DWMi18n.tabsCount(session.tabs.length);

    info.append(name, meta);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-dwm flex-shrink-0";
    btn.textContent = "↺ " + DWMi18n.t("btn_restore");
    btn.addEventListener("click", () => restoreSession(session));

    card.append(info, btn);
    list.appendChild(card);
  });
}

/* ----------------------------- Bootstrap -------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  await DWMi18n.init();
  DWMi18n.apply();
  DWMi18n.bindSwitch(document.getElementById("langSwitch"));

  // Re-render dynamic content whenever the language changes.
  DWMi18n.onChange(renderRecent);

  document
    .getElementById("btnFreeze")
    .addEventListener("click", freezeCurrentWindow);
  document
    .getElementById("btnDashboard")
    .addEventListener("click", openDashboard);

  await renderRecent();
});
