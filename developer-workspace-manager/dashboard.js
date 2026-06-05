/* ==========================================================================
   dashboard.js
   Full CRUD dashboard backed entirely by chrome.storage.local.
     • Left  — Session Manager: list / search / restore / rename / delete
               sessions, and delete individual links inside a session.
     • Right — Quick Notes: create / read / update / delete notes and bind
               each note to a specific session.
   Vanilla ES6+, async/await, no inline handlers (MV3 CSP safe).
   ========================================================================== */

"use strict";

/* ----------------------------- App state -------------------------------- */

const state = {
  currentNoteId: null, // note currently loaded in the editor (null = new)
  sessions: [], // cached for rendering + bind dropdown
  notes: [],
};

/** Same scheme guard as the popup — some URLs can't be reopened. */
const UNSUPPORTED_SCHEMES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
];
const isRestorable = (url) =>
  !!url && !UNSUPPORTED_SCHEMES.some((s) => url.startsWith(s));

/* ----------------------------- Helpers ---------------------------------- */

/** Short, locale-aware date string. */
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(DWMi18n.lang === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Open a single URL in a new tab if its scheme is restorable. */
async function openUrl(url) {
  if (isRestorable(url)) await chrome.tabs.create({ url, active: false });
}

/* =========================================================================
   SESSIONS
   ======================================================================= */

/** Snapshot the current window into a new session (with optional name). */
async function snapshotCurrentWindow() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const mapped = tabs
    .filter((t) => t.url)
    .map((t) => ({ url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl || "" }));

  if (mapped.length === 0) {
    DWMUI.toast(DWMi18n.t("toast_no_tabs"), { danger: true });
    return;
  }

  const name = await DWMUI.prompt(DWMi18n.t("btn_snapshot"), {
    placeholder: DWMi18n.t("session_name_ph"),
  });
  if (name === null) return; // user cancelled

  await DWMStore.addSession(name, mapped);
  DWMUI.toast(DWMi18n.t("toast_saved"));
  await refreshSessions();
}

/** Restore every restorable link of a session. */
async function restoreSession(session) {
  DWMUI.toast(DWMi18n.t("toast_restoring"));
  for (const tab of session.tabs) {
    if (isRestorable(tab.url)) await chrome.tabs.create({ url: tab.url, active: false });
  }
}

/** Prompt for a new name and rename a session. */
async function renameSessionFlow(session) {
  const name = await DWMUI.prompt(DWMi18n.t("rename_title"), {
    value: session.name,
    placeholder: DWMi18n.t("rename_ph"),
  });
  if (name === null || !name.trim()) return;
  await DWMStore.renameSession(session.id, name);
  DWMUI.toast(DWMi18n.t("toast_renamed"));
  await refreshSessions();
}

/** Confirm + delete a whole session. */
async function deleteSessionFlow(session) {
  const ok = await DWMUI.confirm(DWMi18n.t("confirm_del_session"));
  if (!ok) return;
  await DWMStore.deleteSession(session.id);
  DWMUI.toast(DWMi18n.t("toast_session_deleted"), { danger: true });
  await refreshSessions();
  await refreshNotes(); // notes may have been unbound
}

/** Confirm + remove a single link from a session. */
async function deleteLinkFlow(sessionId, index) {
  const ok = await DWMUI.confirm(DWMi18n.t("confirm_del_link"));
  if (!ok) return;
  await DWMStore.deleteTabFromSession(sessionId, index);
  await refreshSessions();
}

/** Build one session panel (header + collapsible link list). */
function buildSessionPanel(session) {
  const panel = document.createElement("div");
  panel.className = "dwm-panel dwm-enter p-2";

  /* --- header row --- */
  const header = document.createElement("div");
  header.className = "d-flex align-items-center gap-2";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn btn-sm btn-dwm-ghost btn-icon flex-shrink-0";
  toggle.textContent = "▸";
  toggle.setAttribute("aria-label", "expand");

  const titleWrap = document.createElement("div");
  titleWrap.className = "flex-grow-1 overflow-hidden";
  const title = document.createElement("div");
  title.className = "dwm-tab-title fw-semibold";
  title.textContent = session.name;
  const meta = document.createElement("div");
  meta.className = "d-flex gap-2 mt-1";
  const countChip = document.createElement("span");
  countChip.className = "dwm-chip is-cyan";
  countChip.textContent = DWMi18n.tabsCount(session.tabs.length);
  const dateChip = document.createElement("span");
  dateChip.className = "dwm-chip";
  dateChip.textContent = DWMi18n.t("created") + " " + fmtDate(session.createdAt);
  meta.append(countChip, dateChip);
  titleWrap.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "d-flex gap-1 flex-shrink-0";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "btn btn-sm btn-dwm";
  restoreBtn.textContent = "↺";
  restoreBtn.title = DWMi18n.t("btn_restore_session");
  restoreBtn.addEventListener("click", () => restoreSession(session));

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "btn btn-sm btn-dwm-ghost btn-icon";
  renameBtn.textContent = "✎";
  renameBtn.title = DWMi18n.t("btn_rename");
  renameBtn.addEventListener("click", () => renameSessionFlow(session));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-sm btn-dwm-danger btn-icon";
  deleteBtn.textContent = "🗑";
  deleteBtn.title = DWMi18n.t("btn_delete");
  deleteBtn.addEventListener("click", () => deleteSessionFlow(session));

  actions.append(restoreBtn, renameBtn, deleteBtn);
  header.append(toggle, titleWrap, actions);

  /* --- collapsible link list --- */
  const body = document.createElement("div");
  body.className = "mt-2 ps-1 d-none";

  session.tabs.forEach((tab, index) => {
    const row = document.createElement("div");
    row.className = "dwm-tab-row";

    const fav = document.createElement("img");
    fav.className = "dwm-favicon";
    if (tab.favIconUrl) fav.src = tab.favIconUrl;
    fav.addEventListener("error", () => (fav.style.visibility = "hidden"));

    const link = document.createElement("div");
    link.className = "flex-grow-1 overflow-hidden";
    link.style.cursor = "pointer";
    const t = document.createElement("div");
    t.className = "dwm-tab-title";
    t.textContent = tab.title || tab.url;
    const u = document.createElement("div");
    u.className = "dwm-tab-url";
    u.textContent = tab.url;
    link.append(t, u);
    link.addEventListener("click", () => openUrl(tab.url));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-sm btn-dwm-danger btn-icon flex-shrink-0";
    del.textContent = "✕";
    del.title = DWMi18n.t("btn_delete");
    del.addEventListener("click", () => deleteLinkFlow(session.id, index));

    row.append(fav, link, del);
    body.appendChild(row);
  });

  // toggle expand/collapse
  toggle.addEventListener("click", () => {
    const hidden = body.classList.toggle("d-none");
    toggle.textContent = hidden ? "▸" : "▾";
  });

  panel.append(header, body);
  return panel;
}

/** Render the sessions column (optionally filtered by the search box). */
function renderSessions() {
  const listEl = document.getElementById("sessionsList");
  const countEl = document.getElementById("sessionsCount");
  const filter = (document.getElementById("sessionSearch").value || "")
    .trim()
    .toLowerCase();

  const visible = state.sessions.filter((s) =>
    s.name.toLowerCase().includes(filter)
  );

  countEl.textContent = String(state.sessions.length);
  listEl.innerHTML = "";

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dwm-empty";
    empty.textContent = DWMi18n.t("empty_sessions");
    listEl.appendChild(empty);
    return;
  }
  visible.forEach((s) => listEl.appendChild(buildSessionPanel(s)));
}

/** Reload sessions from storage and re-render everything that depends on them. */
async function refreshSessions() {
  state.sessions = await DWMStore.getSessions();
  renderSessions();
  renderBindOptions();
}

/* =========================================================================
   NOTES
   ======================================================================= */

/** Populate the "linked session" <select> in the editor. */
function renderBindOptions() {
  const select = document.getElementById("noteBind");
  const previous = select.value;
  select.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = DWMi18n.t("bind_none");
  select.appendChild(none);

  state.sessions.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = String(s.id);
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  // Keep selection valid (e.g. after a session was deleted).
  select.value = state.sessions.some((s) => String(s.id) === previous)
    ? previous
    : "";
}

/** Load editor with a blank note (creation mode). */
function newNote() {
  state.currentNoteId = null;
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteBody").value = "";
  document.getElementById("noteBind").value = "";
  renderNotes();
  document.getElementById("noteTitle").focus();
}

/** Load an existing note into the editor (edit mode). */
function loadNote(note) {
  state.currentNoteId = note.id;
  document.getElementById("noteTitle").value = note.title || "";
  document.getElementById("noteBody").value = note.body || "";
  document.getElementById("noteBind").value =
    note.sessionId != null ? String(note.sessionId) : "";
  renderNotes();
}

/** Create or update the note currently in the editor. */
async function saveNote() {
  const title = document.getElementById("noteTitle").value;
  const body = document.getElementById("noteBody").value;
  const bindVal = document.getElementById("noteBind").value;
  const sessionId = bindVal === "" ? null : Number(bindVal);

  if (!title.trim() && !body.trim()) {
    DWMUI.toast(DWMi18n.t("toast_empty_note"), { danger: true });
    return;
  }

  if (state.currentNoteId == null) {
    const note = await DWMStore.addNote({ title, body, sessionId });
    state.currentNoteId = note.id;
  } else {
    await DWMStore.updateNote(state.currentNoteId, { title, body, sessionId });
  }

  DWMUI.toast(DWMi18n.t("toast_note_saved"));
  await refreshNotes();
}

/** Confirm + delete the note in the editor. */
async function deleteNote() {
  if (state.currentNoteId == null) {
    newNote();
    return;
  }
  const ok = await DWMUI.confirm(DWMi18n.t("confirm_del_note"));
  if (!ok) return;
  await DWMStore.deleteNote(state.currentNoteId);
  DWMUI.toast(DWMi18n.t("toast_note_deleted"), { danger: true });
  newNote();
  await refreshNotes();
}

/** Build a single note card for the list. */
function buildNoteCard(note) {
  const card = document.createElement("div");
  card.className = "dwm-panel dwm-enter p-2";
  if (note.id === state.currentNoteId) card.classList.add("dwm-note-active");
  card.style.cursor = "pointer";

  const top = document.createElement("div");
  top.className = "d-flex align-items-start gap-2";

  const main = document.createElement("div");
  main.className = "flex-grow-1 overflow-hidden";

  const title = document.createElement("div");
  title.className = "dwm-tab-title fw-semibold";
  title.textContent = note.title.trim() || DWMi18n.t("untitled");

  const snippet = document.createElement("div");
  snippet.className = "dwm-tab-url";
  snippet.textContent = (note.body || "").replace(/\s+/g, " ").slice(0, 80);

  main.append(title, snippet);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn btn-sm btn-dwm-danger btn-icon flex-shrink-0";
  del.textContent = "✕";
  del.title = DWMi18n.t("btn_delete");
  del.addEventListener("click", async (e) => {
    e.stopPropagation(); // don't trigger card → loadNote
    const ok = await DWMUI.confirm(DWMi18n.t("confirm_del_note"));
    if (!ok) return;
    await DWMStore.deleteNote(note.id);
    if (state.currentNoteId === note.id) newNote();
    DWMUI.toast(DWMi18n.t("toast_note_deleted"), { danger: true });
    await refreshNotes();
  });

  top.append(main, del);

  // meta row: linked session chip + updated time
  const meta = document.createElement("div");
  meta.className = "d-flex gap-2 mt-2 flex-wrap";

  if (note.sessionId != null) {
    const linked = state.sessions.find((s) => s.id === note.sessionId);
    if (linked) {
      const chip = document.createElement("span");
      chip.className = "dwm-chip is-accent";
      chip.textContent = DWMi18n.t("link_to") + " " + linked.name;
      meta.appendChild(chip);
    }
  }
  const time = document.createElement("span");
  time.className = "dwm-chip";
  time.textContent = DWMi18n.t("updated") + " " + fmtDate(note.updatedAt);
  meta.appendChild(time);

  card.append(top, meta);
  card.addEventListener("click", () => loadNote(note));
  return card;
}

/** Render the notes list. */
function renderNotes() {
  const listEl = document.getElementById("notesList");
  listEl.innerHTML = "";

  if (state.notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dwm-empty";
    empty.textContent = DWMi18n.t("empty_notes");
    listEl.appendChild(empty);
    return;
  }
  state.notes.forEach((n) => listEl.appendChild(buildNoteCard(n)));
}

/** Reload notes from storage and re-render. */
async function refreshNotes() {
  state.notes = await DWMStore.getNotes();
  renderNotes();
}

/* =========================================================================
   INIT
   ======================================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await DWMi18n.init();
  DWMi18n.apply();
  DWMi18n.bindSwitch(document.getElementById("langSwitch"));

  // When language changes, re-render dynamic content (counts, dates, chips).
  DWMi18n.onChange(() => {
    renderSessions();
    renderBindOptions();
    renderNotes();
  });

  // Header / editor buttons
  document.getElementById("btnSnapshot").addEventListener("click", snapshotCurrentWindow);
  document.getElementById("btnNewNote").addEventListener("click", newNote);
  document.getElementById("btnSaveNote").addEventListener("click", saveNote);
  document.getElementById("btnDeleteNote").addEventListener("click", deleteNote);
  document.getElementById("sessionSearch").addEventListener("input", renderSessions);

  // First paint
  await refreshSessions();
  await refreshNotes();

  // React to changes made elsewhere (e.g. a session frozen from the popup
  // while the dashboard tab stays open).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[DWMStore.KEYS.SESSIONS]) refreshSessions();
    if (changes[DWMStore.KEYS.NOTES]) refreshNotes();
  });
});
