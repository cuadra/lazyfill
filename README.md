# LazyFill

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/f072d2e1-237a-46c9-bc68-33dfec129f9f" />

A Chrome extension that fills in every visible form field on the current page with a single click. Useful for testing multi-step forms — navigate between steps yourself, click the icon on each step to fill the fields.

## What it does

- Detects all visible, enabled inputs, selects, textareas, checkboxes, and radio buttons on the active tab
- Matches each field to a data value using configurable rules based on the field's `name`, `id`, `placeholder`, `type`, and `autocomplete` attributes
- Fires synthetic `input` and `change` events after filling so React, Vue, and Angular forms register the values
- For yes/no radio groups, always selects **No**
- For all other radio groups, selects the first option by default
- Detects custom dropdowns built from `div`s/buttons instead of a native `<select>` (ARIA comboboxes, `aria-haspopup="listbox"` triggers), opens them, and clicks the matching option

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

If new fields appear after a selection or entry (e.g. a conditional field revealed by a dropdown or radio choice), just click the icon again to fill them too.

After editing any file, click the **Refresh** icon on the LazyFill card in `chrome://extensions` to reload the extension.

## Customising fill values

Open `data/test-data.json` and replace the placeholder values with your own:

```json
{
  "firstName": "test",
  "lastName": "test",
  "email": "test@test.com",
  "phone": "5558675309",
  "address": "123 Main St",
  "city": "Springfield",
  "state": "IL",
  "zip": "62701",
  "country": "United States",
  "company": "Acme Corp",
  "username": "janedoe42",
  "password": "TestPass123!",
  "date": "1/15/1990",
  "checkbox": true,
  "radioIndex": 0,
  "dropdownIndex": 0,
  "prescriberNPI": "1234567890",
  "prescriberTaxId": "123456789",
  "practiceName": "Acme Medical Group",
  "stateLicenseNumber": "LIC123456",
  "diagnosisCode": "Z00.00",
  "nextTreatmentDate": "12/1/2026"
}
```

## Targeting a specific site

If a field on a particular site isn't being matched, add a rule to `data/field-config.json`. Each rule has a `dataKey` pointing into `test-data.json` and a list of attribute matchers (regex strings). No changes to `content.js` are needed.

## Custom dropdowns

Dropdowns that are not a native `<select>` (a `div` or `button` that opens a list of `div`/`li` options) are handled after the regular fields, one at a time:

1. The trigger is matched to a data key with the same `field-config.json` rules. Since these triggers rarely have a `name`, the rules also see the trigger's `aria-label` / label text (matcher attr `label`), `data-testid`, and the `name` of any backing hidden `<input>`.
2. The dropdown is opened and the option whose text or `data-value` matches the data value is clicked. Searchable comboboxes get the value typed in first if no option matches.
3. If no rule or no option matches, the option at `dropdownIndex` (default `0`, the first one) is selected.

Which elements count as dropdown triggers and options is controlled by CSS selector lists in `data/dropdown-config.json`. If a site uses a dropdown without ARIA attributes, add its trigger selector (e.g. `.my-select__control`) to `triggerSelectors` and, if needed, its option selector to `optionSelectors`.

`test/custom-dropdowns.html` is a manual test page covering the supported variants.
