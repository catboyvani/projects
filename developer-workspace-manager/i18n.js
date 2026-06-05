/* ==========================================================================
   i18n.js
   1) DWMi18n  — bilingual dictionary (RU / EN) + DOM-binding helpers.
   2) DWMUI    — shared, CSP-safe UI helpers (toast / confirm / prompt modals).
   Loaded before popup.js and dashboard.js.
   ========================================================================== */

(function (global) {
  "use strict";

  /* =======================================================================
     1. Internationalization
     ===================================================================== */

  const DICT = {
    en: {
      app_name: "Workspace Manager",
      tagline: "local-first sessions & notes",

      // popup
      session_name_ph: "Session name (optional)…",
      new_session: "New session",
      btn_freeze: "Freeze current window",
      btn_dashboard: "Open full dashboard",
      recent_sessions: "Recent sessions",
      btn_restore: "Restore",
      empty_recent: "No saved sessions yet. Freeze your first window above.",

      // dashboard
      dash_sessions: "Session Manager",
      dash_notes: "Quick Notes",
      btn_snapshot: "Snapshot current window",
      search_ph: "Filter sessions…",
      btn_restore_session: "Restore all",
      btn_rename: "Rename",
      btn_delete: "Delete",
      btn_new_note: "New note",
      note_title_ph: "Note title…",
      note_body_ph: "Write your note here…",
      bind_label: "Linked session",
      bind_none: "— not linked —",
      btn_save_note: "Save note",
      notes_list: "Notes",
      empty_sessions: "No sessions saved yet. Snapshot a window to begin.",
      empty_notes: "No notes yet. Create one to get started.",
      no_note_selected: "Select a note on the left, or create a new one.",
      untitled: "untitled note",
      created: "created",
      updated: "updated",
      saved_ok: "Saved",
      link_to: "→",

      // confirms / prompts
      confirm_del_session: "Delete this session and all its links?",
      confirm_del_note: "Delete this note permanently?",
      confirm_del_link: "Remove this link from the session?",
      rename_title: "Rename session",
      rename_ph: "New session name",
      ok: "Confirm",
      cancel: "Cancel",

      // toasts
      toast_saved: "Session frozen",
      toast_no_tabs: "No tabs to save",
      toast_empty_note: "Nothing to save",
      toast_restoring: "Restoring session…",
      toast_session_deleted: "Session deleted",
      toast_note_saved: "Note saved",
      toast_note_deleted: "Note deleted",
      toast_renamed: "Session renamed",
    },
    ru: {
      app_name: "Менеджер рабочих пространств",
      tagline: "локальные сессии и заметки",

      session_name_ph: "Имя сессии (необязательно)…",
      new_session: "Новая сессия",
      btn_freeze: "Законсервировать текущее окно",
      btn_dashboard: "Открыть полную панель управления",
      recent_sessions: "Последние сессии",
      btn_restore: "Восстановить",
      empty_recent: "Сохранённых сессий пока нет. Законсервируйте первое окно.",

      dash_sessions: "Менеджер сессий",
      dash_notes: "Быстрые заметки",
      btn_snapshot: "Снимок текущего окна",
      search_ph: "Поиск по сессиям…",
      btn_restore_session: "Восстановить всё",
      btn_rename: "Переименовать",
      btn_delete: "Удалить",
      btn_new_note: "Новая заметка",
      note_title_ph: "Заголовок заметки…",
      note_body_ph: "Введите текст заметки…",
      bind_label: "Привязка к сессии",
      bind_none: "— без привязки —",
      btn_save_note: "Сохранить заметку",
      notes_list: "Заметки",
      empty_sessions: "Сессий пока нет. Сделайте снимок окна, чтобы начать.",
      empty_notes: "Заметок пока нет. Создайте первую.",
      no_note_selected: "Выберите заметку слева или создайте новую.",
      untitled: "заметка без названия",
      created: "создана",
      updated: "обновлена",
      saved_ok: "Сохранено",
      link_to: "→",

      confirm_del_session: "Удалить эту сессию и все её ссылки?",
      confirm_del_note: "Удалить эту заметку навсегда?",
      confirm_del_link: "Убрать эту ссылку из сессии?",
      rename_title: "Переименовать сессию",
      rename_ph: "Новое имя сессии",
      ok: "Подтвердить",
      cancel: "Отмена",

      toast_saved: "Окно законсервировано",
      toast_no_tabs: "Нет вкладок для сохранения",
      toast_empty_note: "Нечего сохранять",
      toast_restoring: "Восстанавливаю сессию…",
      toast_session_deleted: "Сессия удалена",
      toast_note_saved: "Заметка сохранена",
      toast_note_deleted: "Заметка удалена",
      toast_renamed: "Сессия переименована",
    },
  };

  const i18n = {
    lang: "en",
    _listeners: [],

    /** Resolve initial language: stored choice > browser UI language > 'en'. */
    async init() {
      const stored = await DWMStore.getLang();
      if (stored === "ru" || stored === "en") {
        this.lang = stored;
      } else {
        const ui = (chrome.i18n.getUILanguage() || "en").toLowerCase();
        this.lang = ui.startsWith("ru") ? "ru" : "en";
      }
      return this.lang;
    },

    /** Translate a key, replacing {placeholders} from `vars`. */
    t(key, vars) {
      let str = (DICT[this.lang] && DICT[this.lang][key]) || DICT.en[key] || key;
      if (vars) {
        Object.keys(vars).forEach((k) => {
          str = str.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
        });
      }
      return str;
    },

    /** Locale-aware "N tabs" / "N вкладок". */
    tabsCount(n) {
      if (this.lang === "ru") {
        const m10 = n % 10;
        const m100 = n % 100;
        let word = "вкладок";
        if (m10 === 1 && m100 !== 11) word = "вкладка";
        else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) word = "вкладки";
        return n + " " + word;
      }
      return n + (n === 1 ? " tab" : " tabs");
    },

    /** Bind translations to DOM: [data-i18n], [data-i18n-ph], [data-i18n-title]. */
    apply(root = document) {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = this.t(el.getAttribute("data-i18n"));
      });
      root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
        el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-ph")));
      });
      root.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.setAttribute("title", this.t(el.getAttribute("data-i18n-title")));
      });
      document.documentElement.setAttribute("lang", this.lang);
    },

    /** Switch language, persist it, re-apply, and notify listeners. */
    async setLang(lang) {
      if (lang !== "ru" && lang !== "en") return;
      this.lang = lang;
      await DWMStore.setLang(lang);
      this.apply();
      this._listeners.forEach((cb) => cb(lang));
    },

    /** Subscribe to language changes (used to re-render dynamic content). */
    onChange(cb) {
      this._listeners.push(cb);
    },

    /** Wire up a `.dwm-lang` switch container with EN/RU buttons. */
    bindSwitch(container) {
      if (!container) return;
      const sync = () => {
        container.querySelectorAll("button").forEach((b) => {
          b.classList.toggle("active", b.dataset.lang === this.lang);
        });
      };
      container.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", async () => {
          await this.setLang(b.dataset.lang);
          sync();
        });
      });
      this.onChange(sync);
      sync();
    },
  };

  /* =======================================================================
     2. UI helpers (toast + custom confirm/prompt) — all CSP-safe, no inline JS
     ===================================================================== */

  const ui = {
    /** Show a transient toast. */
    toast(message, opts = {}) {
      let wrap = document.querySelector(".dwm-toast-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "dwm-toast-wrap";
        document.body.appendChild(wrap);
      }
      const el = document.createElement("div");
      el.className = "dwm-toast" + (opts.danger ? " is-danger" : "");
      el.textContent = message;
      wrap.appendChild(el);
      setTimeout(() => {
        el.style.transition = "opacity .25s ease";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 260);
      }, opts.duration || 2200);
    },

    /** Custom themed confirm. @returns {Promise<boolean>} */
    confirm(message, { okText, cancelText } = {}) {
      return this._modal({
        message,
        okText: okText || i18n.t("ok"),
        cancelText: cancelText || i18n.t("cancel"),
        withInput: false,
      }).then((res) => res !== null);
    },

    /** Custom themed prompt. @returns {Promise<string|null>} (null = cancelled) */
    prompt(message, { value = "", placeholder = "", okText, cancelText } = {}) {
      return this._modal({
        message,
        value,
        placeholder,
        okText: okText || i18n.t("ok"),
        cancelText: cancelText || i18n.t("cancel"),
        withInput: true,
      });
    },

    /** Internal modal builder. Resolves with input string, true, or null. */
    _modal({ message, value, placeholder, okText, cancelText, withInput }) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.cssText =
          "position:fixed;inset:0;z-index:1090;display:flex;" +
          "align-items:center;justify-content:center;" +
          "background:rgba(0,0,0,.6);backdrop-filter:blur(2px);";

        const box = document.createElement("div");
        box.className = "dwm-card dwm-enter";
        box.style.cssText =
          "width:min(420px,92vw);padding:18px;margin:14px;";

        const msg = document.createElement("p");
        msg.className = "mb-3 dwm-mono";
        msg.style.cssText = "white-space:pre-wrap;color:var(--dwm-text);";
        msg.textContent = message;
        box.appendChild(msg);

        let input = null;
        if (withInput) {
          input = document.createElement("input");
          input.type = "text";
          input.className = "form-control mb-3";
          input.value = value || "";
          if (placeholder) input.placeholder = placeholder;
          box.appendChild(input);
        }

        const row = document.createElement("div");
        row.className = "d-flex justify-content-end gap-2";

        const cancel = document.createElement("button");
        cancel.className = "btn btn-sm btn-dwm-ghost";
        cancel.textContent = cancelText;

        const ok = document.createElement("button");
        ok.className = "btn btn-sm btn-dwm";
        ok.textContent = okText;

        row.append(cancel, ok);
        box.appendChild(row);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const close = (result) => {
          overlay.remove();
          document.removeEventListener("keydown", onKey);
          resolve(result);
        };
        const onKey = (e) => {
          if (e.key === "Escape") close(null);
          if (e.key === "Enter" && withInput) close(input.value);
        };

        cancel.addEventListener("click", () => close(null));
        ok.addEventListener("click", () =>
          close(withInput ? input.value : true)
        );
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close(null);
        });
        document.addEventListener("keydown", onKey);

        if (input) {
          input.focus();
          input.select();
        } else {
          ok.focus();
        }
      });
    },
  };

  global.DWMi18n = i18n;
  global.DWMUI = ui;
})(window);
