# LazyFill

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/f072d2e1-237a-46c9-bc68-33dfec129f9f" />

A Chrome extension that fills in every visible form field on the current page with a single click. Useful for testing multi-step forms — navigate between steps yourself, click the icon on each step to fill the fields.

## What it does

- Detects all visible, enabled inputs, selects, textareas, checkboxes, and radio buttons on the active tab
- Matches each field to a data value using configurable rules based on the field's `name`, `id`, `placeholder`, `type`, and `autocomplete` attributes
- Fires synthetic `input` and `change` events after filling so React, Vue, and Angular forms register the values
- For yes/no radio groups, always selects **No**
- For all other radio groups, selects the first option by default

The fill values live in `data/test-data.json` — edit that file to use your own data.

## Installation

No build step required.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked** and select the repository folder
5. The LazyFill icon will appear in your Chrome toolbar

## Usage

Navigate to any page with a form and click the LazyFill icon in the toolbar. Fields are filled immediately — no popup, no confirmation.

After editing any file, click the **Refresh** icon on the LazyFill card in `chrome://extensions` to reload the extension.

## Customising fill values

Open `data/test-data.json` and replace the placeholder values with your own:

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

## Targeting a specific site

If a field on a particular site isn't being matched, add a rule to `data/field-config.json`. Each rule has a `dataKey` pointing into `test-data.json` and a list of attribute matchers (regex strings). No changes to `content.js` are needed.
