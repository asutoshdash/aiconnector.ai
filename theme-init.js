try {
  const theme = localStorage.getItem('aiconnector-theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="color-scheme"]').content = theme;
  }
} catch {}
