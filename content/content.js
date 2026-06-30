(async () => {
  const [config, data] = await Promise.all([
    fetch(chrome.runtime.getURL('data/field-config.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('data/test-data.json')).then(r => r.json())
  ]);

  function isVisible(el) {
    if (el.type === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findDataKey(el) {
    for (const rule of config) {
      const matched = rule.matchers.some(({ attr, pattern }) => {
        const re = new RegExp(pattern, 'i');
        let val = '';
        if (attr === 'type')         val = el.type || '';
        else if (attr === 'name')    val = el.name || '';
        else if (attr === 'id')      val = el.id || '';
        else if (attr === 'placeholder')  val = el.placeholder || '';
        else if (attr === 'autocomplete') val = el.autocomplete || '';
        return re.test(val);
      });
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

  function collectFields(root) {
    const fields = [];
    const walk = (node) => {
      fields.push(...node.querySelectorAll('input, select, textarea'));
      for (const el of node.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return fields;
  }

  const seenRadioGroups = new Set();

  for (const el of collectFields(document)) {
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
})().catch(console.error);
