/* ==========================================================================
   storage.js
   Thin async data-access layer over chrome.storage.local.
   Shared by popup.js and dashboard.js. Exposes a global `DWMStore`.
   All business data lives client-side only — no server, no network.
   ========================================================================== */

(function (global) {
  "use strict";

  // Storage keys (single source of truth).
  const KEYS = {
    SESSIONS: "dwm_sessions",
    NOTES: "dwm_notes",
    LANG: "dwm_lang",
  };

  /**
   * Read a key from chrome.storage.local.
   * @param {string} key
   * @param {*} fallback value returned when the key is absent
   * @returns {Promise<*>}
   */
  async function get(key, fallback) {
    const data = await chrome.storage.local.get(key);
    // `data[key]` is undefined when the key was never written.
    return data[key] === undefined ? fallback : data[key];
  }

  /**
   * Write a single key to chrome.storage.local.
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   */
  async function set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  /* ----------------------------- Sessions -------------------------------- */

  /** @returns {Promise<Array>} all saved sessions (newest first is up to caller) */
  async function getSessions() {
    const sessions = await get(KEYS.SESSIONS, []);
    return Array.isArray(sessions) ? sessions : [];
  }

  /** Persist the full sessions array. @param {Array} sessions */
  async function saveSessions(sessions) {
    await set(KEYS.SESSIONS, sessions);
  }

  /**
   * Add a new session built from a list of tabs.
   * @param {string} name human-readable session name
   * @param {Array<{url:string,title:string,favIconUrl:string}>} tabs
   * @returns {Promise<Object>} the newly created session
   */
  async function addSession(name, tabs) {
    const sessions = await getSessions();
    const session = {
      id: Date.now(), // unique enough for a single-user local tool
      name: name && name.trim() ? name.trim() : defaultSessionName(),
      createdAt: new Date().toISOString(),
      tabs: Array.isArray(tabs) ? tabs : [],
    };
    // Newest on top.
    sessions.unshift(session);
    await saveSessions(sessions);
    return session;
  }

  /** Rename a session by id. @returns {Promise<boolean>} found & updated */
  async function renameSession(id, newName) {
    const sessions = await getSessions();
    const target = sessions.find((s) => s.id === id);
    if (!target) return false;
    target.name = newName && newName.trim() ? newName.trim() : target.name;
    await saveSessions(sessions);
    return true;
  }

  /** Delete a whole session and detach any notes bound to it. */
  async function deleteSession(id) {
    const sessions = await getSessions();
    const next = sessions.filter((s) => s.id !== id);
    await saveSessions(next);

    // Keep notes consistent: unbind notes that referenced this session.
    const notes = await getNotes();
    let touched = false;
    notes.forEach((n) => {
      if (n.sessionId === id) {
        n.sessionId = null;
        touched = true;
      }
    });
    if (touched) await saveNotes(notes);
  }

  /** Remove a single tab (by index) from a session. */
  async function deleteTabFromSession(sessionId, tabIndex) {
    const sessions = await getSessions();
    const target = sessions.find((s) => s.id === sessionId);
    if (!target || !Array.isArray(target.tabs)) return false;
    target.tabs.splice(tabIndex, 1);
    await saveSessions(sessions);
    return true;
  }

  function defaultSessionName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `session ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  /* ------------------------------- Notes --------------------------------- */

  async function getNotes() {
    const notes = await get(KEYS.NOTES, []);
    return Array.isArray(notes) ? notes : [];
  }

  async function saveNotes(notes) {
    await set(KEYS.NOTES, notes);
  }

  /** Create a blank/seeded note. @returns {Promise<Object>} the new note */
  async function addNote({ title = "", body = "", sessionId = null } = {}) {
    const notes = await getNotes();
    const now = new Date().toISOString();
    const note = {
      id: Date.now(),
      title: title,
      body: body,
      sessionId: sessionId,
      createdAt: now,
      updatedAt: now,
    };
    notes.unshift(note);
    await saveNotes(notes);
    return note;
  }

  /** Patch fields of a note by id. @returns {Promise<Object|null>} */
  async function updateNote(id, patch) {
    const notes = await getNotes();
    const note = notes.find((n) => n.id === id);
    if (!note) return null;
    Object.assign(note, patch, { updatedAt: new Date().toISOString() });
    await saveNotes(notes);
    return note;
  }

  async function deleteNote(id) {
    const notes = await getNotes();
    await saveNotes(notes.filter((n) => n.id !== id));
  }

  /* ----------------------------- Language -------------------------------- */

  async function getLang() {
    return await get(KEYS.LANG, null); // null => decide from browser
  }
  async function setLang(lang) {
    await set(KEYS.LANG, lang);
  }

  // Public API
  global.DWMStore = {
    KEYS,
    get,
    set,
    // sessions
    getSessions,
    saveSessions,
    addSession,
    renameSession,
    deleteSession,
    deleteTabFromSession,
    // notes
    getNotes,
    saveNotes,
    addNote,
    updateNote,
    deleteNote,
    // language
    getLang,
    setLang,
  };
})(window);
