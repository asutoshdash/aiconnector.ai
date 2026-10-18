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

})();
