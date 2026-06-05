# Developer Workspace & Local Notes Manager

A fully offline Chrome extension (Manifest V3) that snapshots browser windows
into named **sessions**, restores them in one click, and keeps **quick notes**
that can be linked to a session. All data lives client-side in
`chrome.storage.local` with `unlimitedStorage` — **no server, no network calls.**

Built with **Vanilla JS (ES6+)**, `async/await` over the `chrome.*` promise APIs,
and a custom dark "terminal / cyber-IT" theme on top of a **locally bundled
Bootstrap 5** (no CDN, to satisfy the MV3 Content Security Policy). UI is
**bilingual (EN / RU)** with a live language switch.

## Features

- **Popup** — freeze the current window into a session, open the dashboard,
  and restore one of the last 3 sessions in a click.
- **Dashboard**
  - *Session Manager* (left): list / search / restore / rename / delete
    sessions, expand a session to see its links, delete individual links.
  - *Quick Notes* (right): full CRUD for notes, plus binding a note to a
    specific session.
- Live cross-page sync via `chrome.storage.onChanged`.

## Project structure

```
manifest.json        Manifest V3 (permissions, action, icons)
popup.html / .js      Quick-access popup
dashboard.html / .js  Full management page
storage.js            Async data layer over chrome.storage.local
i18n.js               EN/RU dictionary + toast/confirm/prompt UI helpers
styles.css            Dark terminal theme + Bootstrap overrides
dist/                 Locally bundled Bootstrap 5 + JetBrains Mono font
icon.png              ← ADD THIS YOURSELF (used for all icon sizes)
```

## Install (load unpacked)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and open the popup.

## Data model (`chrome.storage.local`)

```jsonc
"dwm_sessions": [
  { "id": 1717500000000, "name": "research", "createdAt": "ISO",
    "tabs": [ { "url": "...", "title": "...", "favIconUrl": "..." } ] }
],
"dwm_notes": [
  { "id": 1717500001111, "title": "...", "body": "...",
    "sessionId": 1717500000000, "createdAt": "ISO", "updatedAt": "ISO" }
],
"dwm_lang": "en"
```

## Notes

- Internal URLs (`chrome://`, `about:`, `view-source:`, etc.) are stored but
  skipped on restore, since the browser refuses to reopen them via `tabs.create`.
- No inline scripts or event handlers are used anywhere, keeping the extension
  compliant with the default MV3 CSP.
