# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Chrome extension (Manifest V3)** that auto-fills form fields on any web page when the user clicks the extension icon. The user navigates multi-step forms manually (clicking Next, Submit, etc.); the extension only handles filling visible fields on the current step.

## Architecture

```
lazyfill/
├── manifest.json          # MV3 extension config — permissions, service worker, web-accessible resources
├── background.js          # Service worker — listens for icon click, injects content script
├── content/
│   └── content.js         # Injected into active tab — finds and fills all visible fields
└── data/
    ├── test-data.json     # ← SINGLE SOURCE OF TRUTH for all fill values (edit this)
    └── field-config.json  # ← Field type matching rules and selector hints (edit this)
```

There is no popup. The extension triggers directly on icon click via `chrome.action.onClicked`.

### Data files (primary editing targets)

**`data/test-data.json`** — All reusable test values in one place. Keys map to semantic field purposes:
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@example.com",
  "phone": "555-867-5309",
  "address": "123 Main St",
  "city": "Springfield",
  "state": "IL",
  "zip": "62701",
  "country": "United States",
  "company": "Acme Corp",
  "username": "janedoe42",
  "password": "TestPass123!",
  "date": "1990-01-15",
  "checkbox": true,
  "radioIndex": 0
}
```

**`data/field-config.json`** — Rules that map field attributes (name, id, placeholder, type) to data keys. Each rule has a priority list of attribute matchers (regex strings) and a `dataKey` pointing into `test-data.json`. Adding a new rule here is how you target a previously unmatched field.

### Trigger flow

1. User clicks the extension icon → `chrome.action.onClicked` fires in `background.js`
2. `background.js` calls `chrome.scripting.executeScript` to inject `content.js` into the active tab
3. `content.js` loads `field-config.json` and `test-data.json` via `chrome.runtime.getURL` + `fetch`
4. For each visible, enabled, non-hidden form field: match against field-config rules → fill with the mapped data value

`chrome.action.onClicked` only fires when the action has **no** `default_popup` set. If a popup is ever added back, the click event stops firing — use `chrome.runtime.onMessage` from the popup instead.

### Field type handling in `content.js`

| Field type | Fill strategy |
|---|---|
| `input[type=text/email/number/tel/url/search]` | `.value = data[key]` + trigger `input` and `change` events |
| `input[type=password]` | Same as text |
| `input[type=date]` | Set `.value` to ISO date string (`YYYY-MM-DD`) |
| `input[type=checkbox]` | Set `.checked = data[key]` (boolean) |
| `input[type=radio]` | Yes/No groups (detected by value or label text matching `/^(yes\|no)$/i`): always select the "No" radio. All other groups: check the nth radio (index from `data.radioIndex`, default 0). |
| `select` | Set `.value` or fall back to setting `selectedIndex` |
| `textarea` | `.value = data[key]` |

Native React/Vue/Angular change detection requires dispatching synthetic events after setting `.value` — always fire `new Event('input', { bubbles: true })` and `new Event('change', { bubbles: true })`.

## Loading the extension (no build step)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this folder
4. After any file edit: click the **Refresh** icon on the extension card in `chrome://extensions`

Manifest V3 service workers do not persist — do not store state in `background.js` global variables.

## Manifest V3 requirements

- `"manifest_version": 3`
- Permissions needed: `"activeTab"`, `"scripting"` (add `"tabs"` only if you need `chrome.tabs.query`; add `"storage"` if saving user options)
- Content scripts should be injected programmatically via `chrome.scripting.executeScript` rather than declared in `manifest.json`, so they only run on demand
- Use `chrome.runtime.getURL("data/test-data.json")` to load JSON data files from inside the extension; these files must be listed under `"web_accessible_resources"` in `manifest.json`

## Extending for a specific site

To target site-specific selectors (e.g. a field with an unusual name attribute), add a rule to `data/field-config.json` rather than hardcoding anything in `content.js`. The config-driven approach keeps `content.js` generic and site agnosticism preserved.
