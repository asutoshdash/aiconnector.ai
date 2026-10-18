(() => {
  const themeToggle = document.querySelector('#theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const themeKey = 'aiconnector-theme';
  function currentTheme() {
    return document.documentElement.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
  }
  function syncTheme() {
    const dark = currentTheme() === 'dark';
    const icon = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
      : '<path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z"/>';
    themeToggle.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icon}</svg>`;
    themeToggle.title = `Switch to ${dark ? 'light' : 'dark'} mode`;
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

})();
