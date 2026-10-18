(() => {
  const themeToggle = document.querySelector('#theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const themeKey = 'aiconnector-theme';
  function currentTheme() {
    return document.documentElement.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
  }
  function syncTheme() {
    const dark = currentTheme() === 'dark';
    themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
    themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.content = dark ? '#07111f' : '#f5f8fa';
    });
  }
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="color-scheme"]').content = document.documentElement.dataset.theme || 'light dark';
    syncTheme();
  }
  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    const override = next === (systemTheme.matches ? 'dark' : 'light') ? null : next;
    applyTheme(override);
    try {
      if (override) localStorage.setItem(themeKey, override);
      else localStorage.removeItem(themeKey);
    } catch {}
  });
  systemTheme.addEventListener('change', syncTheme);
  window.addEventListener('storage', event => {
    if (event.key === themeKey || event.key === null) applyTheme(event.newValue);
  });
  syncTheme();
  themeToggle.hidden = false;

  const cards = [...document.querySelectorAll('.tool-card')];
  const form = document.querySelector('.filters');
  const search = document.querySelector('#search');
  const category = document.querySelector('#category');
  const count = document.querySelector('#result-count');
  const selected = new Set();
  const bar = document.querySelector('.compare-bar');
  const open = document.querySelector('#open-compare');
  const dialog = document.querySelector('#comparison');
  let timer;

  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    const legacyCategory = params.get('category') || '';
    const requested = legacyCategory === 'MCP integrations' ? 'MCP connectors' : legacyCategory;
    category.value = [...category.options].some(option => option.value === requested) ? requested : '';
  }

  function filter(updateURL = true) {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('[data-category-note]').forEach(note => {
      note.hidden = note.dataset.categoryNote !== category.value;
    });
    let visible = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.hidden = !terms.every(term => text.includes(term)) || Boolean(category.value && card.dataset.category !== category.value);
      if (!card.hidden) visible++;
    });
    clearTimeout(timer);
    timer = setTimeout(() => { count.textContent = `${visible} ${visible === 1 ? 'tool' : 'tools'} to explore`; }, 180);
    document.querySelector('#empty').hidden = visible !== 0;
    if (updateURL) {
      const url = new URL(location.href);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim());
      else url.searchParams.delete('q');
      if (category.value) url.searchParams.set('category', category.value);
      else url.searchParams.delete('category');
      history.replaceState(null, '', url);
    }
  }

  function updateSelection() {
    document.querySelectorAll('.compare-choice input').forEach(input => {
      input.checked = selected.has(input.value);
      input.disabled = selected.size === 3 && !input.checked;
    });
    bar.hidden = selected.size === 0;
    document.querySelector('#selection-status').textContent = `${selected.size} of 3 selected${selected.size === 3 ? ' · Limit reached' : ''}`;
    open.disabled = selected.size < 2;
  }

  form.hidden = false;
  document.querySelectorAll('.compare-choice').forEach(label => { label.hidden = false; });
  search.addEventListener('input', () => filter());
  category.addEventListener('change', () => filter());
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('reset', () => { search.value = ''; category.value = ''; filter(); });
  document.querySelector('#empty-reset').addEventListener('click', () => { form.reset(); search.focus(); });
  window.addEventListener('popstate', () => { readURL(); filter(false); });
  document.querySelector('.tool-grid').addEventListener('change', event => {
    const input = event.target;
    if (!input.matches('.compare-choice input')) return;
    if (input.checked && selected.size < 3) selected.add(input.value);
    else selected.delete(input.value);
    updateSelection();
  });
  document.querySelector('#clear-selection').addEventListener('click', () => {
    const first = cards.find(card => selected.has(card.id) && !card.hidden);
    selected.clear();
    updateSelection();
    (first?.querySelector('input') || search).focus();
  });
  open.addEventListener('click', () => {
    const tools = cards.filter(card => selected.has(card.id));
    const table = document.querySelector('#comparison-table');
    table.replaceChildren();
    const caption = table.createCaption();
    caption.textContent = 'Official-source summaries · Checked 18 Oct 2026 · Not hands-on tested';
    const header = table.createTHead().insertRow();
    for (const name of ['Attribute', ...tools.map(card => card.querySelector('h3').textContent)]) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; header.append(th);
    }
    const body = table.createTBody();
    const rows = [
      ['Category', card => card.dataset.category],
      ['Format', card => card.dataset.format],
      ['Use case', card => card.querySelector('.tool-use span').textContent],
      ['Getting started', card => card.dataset.setup],
      ['Pricing & requirements', () => 'Check current terms with the provider'],
      ['Official source', card => card.querySelector('.visit-link').cloneNode(true)]
    ];
    if (tools.some(card => card.dataset.category === 'MCP connectors')) {
      const connectorFields = [
        ['Workflow', 'area'],
        ['Maintainer', 'maintainer'],
        ['Compatible clients', 'clients'],
        ['Authentication', 'auth'],
        ['Permissions & actions', 'permissions']
      ];
      rows.splice(3, 0, ...connectorFields.map(([label, field]) => [
        label, card => card.dataset[field] || 'Not cataloged for this tool'
      ]));
    }
    if (tools.some(card => card.dataset.category === 'Agent frameworks')) {
      const frameworkFields = [
        ['Primary focus', 'focus'],
        ['Languages / scope', 'languages'],
        ['Model support', 'models'],
        ['State, recovery & approvals', 'controls'],
        ['Tools & integrations', 'integrations'],
        ['Testing & deployment', 'operations'],
        ['License', 'license'],
        ['Consider before choosing', 'tradeoff']
      ];
      rows.splice(3, 0, ...frameworkFields.map(([label, field]) => [
        label, card => card.dataset[field] || 'Not cataloged for this tool'
      ]));
    }
    for (const [name, value] of rows) {
      const row = body.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = name; row.append(th);
      tools.forEach(card => {
        const cell = row.insertCell(); const content = value(card);
        if (typeof content === 'string') cell.textContent = content;
        else cell.append(content);
      });
    }
    dialog.showModal();
  });
  document.querySelector('#close-compare').addEventListener('click', () => dialog.close());
  readURL();
  filter(false);
})();
