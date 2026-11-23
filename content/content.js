(async () => {
  const [config, data, dropdownConfig] = await Promise.all([
    fetch(chrome.runtime.getURL('data/field-config.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('data/test-data.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('data/dropdown-config.json')).then(r => r.json())
  ]);

  function isVisible(el) {
    if (el.type === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  // Text of the label associated with a custom (non-native) control.
  function labelText(el) {
    const root = el.getRootNode();
    const byId = id => (root.getElementById ? root.getElementById(id) : document.getElementById(id));
    const own = [el, ...el.querySelectorAll('[aria-label], [aria-labelledby]')];
    for (const node of own) {
      const aria = node.getAttribute('aria-label');
      if (aria) return aria.trim();
      const ids = (node.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
      const text = ids.map(id => byId(id)?.textContent.trim() || '').join(' ').trim();
      if (text) return text;
    }
    if (el.id) {
      const lbl = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const wrapping = el.closest('label');
    if (wrapping) return wrapping.textContent.trim();
    // Unassociated label sitting next to the control: <label>State</label><div class="dropdown">…
    let ancestor = el.parentElement;
    for (let i = 0; i < 3 && ancestor; i++, ancestor = ancestor.parentElement) {
      const lbl = ancestor.querySelector('label, legend');
      if (lbl) return lbl.textContent.trim();
    }
    return '';
  }

  // The attributes that field-config matchers run against. Custom dropdowns are
  // usually plain divs/buttons, so their identity is pieced together from ARIA
  // attributes, data-* attributes and any backing <input name="…">.
  function describe(el, isCustomDropdown) {
    if (!isCustomDropdown) {
      return {
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        autocomplete: el.autocomplete || '',
        label: ''
      };
    }
    const attr = name => el.getAttribute(name) || '';
    const inner = sel => el.querySelector(sel) || el.parentElement?.querySelector(`:scope > ${sel}`);
    return {
      type: 'custom-dropdown',
      name: attr('name') || attr('data-name') || inner('input[name]')?.name || '',
      id: el.id || attr('data-testid') || inner('input[id]')?.id || '',
      placeholder: el.placeholder || attr('aria-placeholder') || attr('data-placeholder') ||
        inner('input[placeholder]')?.placeholder || '',
      autocomplete: attr('autocomplete') || inner('input[autocomplete]')?.autocomplete || '',
      label: labelText(el)
    };
  }

  function findDataKey(el, isCustomDropdown = false) {
    const attrs = describe(el, isCustomDropdown);
    for (const rule of config) {
      const matched = rule.matchers.some(({ attr, pattern }) =>
        new RegExp(pattern, 'i').test(attrs[attr] || '')
      );
      if (matched) return rule.dataKey;
    }
    return null;
  }

  function dispatch(el, ...events) {
    for (const type of events)
      el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function fillField(el, dataKey) {
    const value = data[dataKey];
    if (value === undefined) return;

    const type = (el.type || '').toLowerCase();
    const tag  = el.tagName.toLowerCase();

    if (type === 'date') {
      const parts = String(value).split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        el.value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        el.value = String(value);
      }
      dispatch(el, 'input', 'change');
      return;
    }

    if (type === 'checkbox') {
      el.checked = Boolean(value);
      dispatch(el, 'change');
      return;
    }

    if (type === 'radio') {
      const name   = el.name;
      if (!name) return;
      const radios = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`)];

      const labelText = r => {
        const lbl = (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)) || r.closest('label');
        return lbl ? lbl.textContent.trim() : '';
      };
      const isYesNo = radios.some(r => /^(yes|no)$/i.test(r.value) || /^(yes|no)$/i.test(labelText(r)));

      if (isYesNo) {
        const noRadio = radios.find(r => /^no$/i.test(r.value) || /^no$/i.test(labelText(r)));
        if (noRadio) {
          noRadio.checked = true;
          dispatch(noRadio, 'change');
        }
        return;
      }

      const target = radios[Number(value)];
      if (target) {
        target.checked = true;
        dispatch(target, 'change');
      }
      return;
    }

    if (tag === 'select') {
      el.value = String(value);
      if (el.value !== String(value)) {
        const match = [...el.options].find(o =>
          o.text.trim().toLowerCase().includes(String(value).toLowerCase())
        );
        if (match) el.selectedIndex = match.index;
      }
      dispatch(el, 'change');
      return;
    }

    el.value = String(value);
    dispatch(el, 'input', 'change');
  }

  function collectFields(root, selector = 'input, select, textarea') {
    const fields = [];
    const walk = (node) => {
      fields.push(...node.querySelectorAll(selector));
      for (const el of node.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return fields;
  }

  // ── Custom dropdowns (a div/button that opens a list of div/li options) ──

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitFor(fn, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = fn();
      if (result || Date.now() >= deadline) return result;
      await sleep(50);
    }
  }

  function fire(el, ...types) {
    for (const type of types) {
      const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, {
        bubbles: true, cancelable: true, composed: true, view: window, button: 0
      }));
    }
  }

  // Libraries disagree on which event opens a menu / picks an option
  // (mousedown, pointerdown, mouseup or click), so send the whole gesture.
  function press(el) {
    fire(el, 'pointerdown', 'mousedown');
    if (typeof el.focus === 'function') el.focus();
    fire(el, 'pointerup', 'mouseup', 'click');
  }

  // Sets an input's value in a way React-controlled inputs notice.
  function typeInto(input, text) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    dispatch(input, 'input', 'change');
  }

  function findDropdownTriggers() {
    const selector = dropdownConfig.triggerSelectors.join(', ');
    const all = collectFields(document, selector).filter(el =>
      !['select', 'option', 'textarea'].includes(el.tagName.toLowerCase())
    );
    // A wrapper and its inner input can both match — keep only the outermost.
    return all.filter(el => !all.some(other => other !== el && other.contains(el)));
  }

  function isExpanded(trigger) {
    return trigger.getAttribute('aria-expanded') === 'true' ||
      Boolean(trigger.querySelector('[aria-expanded="true"]'));
  }

  // Visible option elements belonging to a trigger: the listbox it points at via
  // aria-controls/aria-owns when available, otherwise anything option-like that
  // was not on screen before the trigger was opened (covers portalled menus).
  function findOptions(trigger, before) {
    const root = trigger.getRootNode();
    const owner = [trigger, ...trigger.querySelectorAll('[aria-controls], [aria-owns]')]
      .map(el => el.getAttribute('aria-controls') || el.getAttribute('aria-owns'))
      .filter(Boolean)
      .map(id => (root.getElementById ? root.getElementById(id) : null) || document.getElementById(id))
      .find(Boolean);

    for (const selector of dropdownConfig.optionSelectors) {
      const candidates = owner
        ? [...owner.querySelectorAll(selector)]
        : collectFields(document, selector).filter(el => !before.has(el));
      const options = candidates.filter(el =>
        isVisible(el) && el !== trigger && !el.contains(trigger) &&
        el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled')
      );
      if (options.length) return options;
    }
    return [];
  }

  function matchOption(options, value) {
    if (typeof value === 'number') return options[value] || null;
    const want = String(value).trim().toLowerCase();
    const text = o => o.textContent.trim().toLowerCase();
    const val  = o => (o.getAttribute('data-value') ?? o.getAttribute('value') ?? '').trim().toLowerCase();
    return options.find(o => text(o) === want || val(o) === want) ||
      options.find(o => text(o).includes(want)) ||
      null;
  }

  async function fillCustomDropdown(trigger, dataKey) {
    const value = data[dataKey];
    if (value === undefined) return;
    const timeout = dropdownConfig.openTimeoutMs ?? 1000;

    const wasOpen = isExpanded(trigger);
    const before = new Set(
      wasOpen ? [] : collectFields(document, dropdownConfig.optionSelectors.join(', ')).filter(isVisible)
    );

    if (!wasOpen) {
      fire(trigger, 'pointerdown', 'mousedown');
      if (typeof trigger.focus === 'function') trigger.focus();
      fire(trigger, 'pointerup', 'mouseup');
      await sleep(30);
      // Only click if mousedown/pointerdown did not already open it, so
      // click-to-toggle menus are not opened and immediately closed again.
      if (!isExpanded(trigger) && !findOptions(trigger, before).length) fire(trigger, 'click');
    }

    let options = await waitFor(() => {
      const found = findOptions(trigger, before);
      return found.length ? found : null;
    }, timeout) || [];
    let choice = matchOption(options, value);

    // Searchable comboboxes may only render options after the user types.
    const input = trigger.matches('input') ? trigger : trigger.querySelector('input:not([type="hidden"])');
    if (!choice && typeof value !== 'number' && input && !input.readOnly && !input.disabled) {
      typeInto(input, String(value));
      choice = await waitFor(() => matchOption(findOptions(trigger, before), value), timeout);
      if (!choice) {
        typeInto(input, '');
        await sleep(100);
      }
    }

    // Nothing matches the mapped value — fall back to the nth option so the
    // field is at least filled.
    if (!choice) {
      options = findOptions(trigger, before);
      choice = options[Number(data.dropdownIndex ?? 0)] || null;
    }

    if (choice) {
      press(choice);
      await sleep(50);
    }

    // Multi-selects (and failed lookups) leave the menu open; close it so the
    // next dropdown starts from a clean page.
    if (isExpanded(trigger) || findOptions(trigger, before).length) {
      const target = input || trigger;
      for (const type of ['keydown', 'keyup'])
        target.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true, composed: true }));
      await sleep(30);
    }
  }

  const dropdownTriggers = findDropdownTriggers().filter(el =>
    !el.disabled && el.getAttribute('aria-disabled') !== 'true' && isVisible(el)
  );
  const insideDropdown = el => dropdownTriggers.some(t => t === el || t.contains(el));

  const seenRadioGroups = new Set();

  for (const el of collectFields(document)) {
    if (insideDropdown(el)) continue;
    if (el.disabled || el.readOnly) continue;

    const type = (el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
    if (!isVisible(el)) continue;

    if (type === 'radio') {
      if (seenRadioGroups.has(el.name)) continue;
      seenRadioGroups.add(el.name);
    }

    const dataKey = findDataKey(el);
    if (dataKey) fillField(el, dataKey);
  }

  // Dropdowns are opened one at a time, after the native fields are done.
  for (const trigger of dropdownTriggers) {
    if (!trigger.isConnected || !isVisible(trigger)) continue;
    const dataKey = findDataKey(trigger, true);
    if (dataKey) await fillCustomDropdown(trigger, dataKey);
  }
})().catch(console.error);
