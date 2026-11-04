(() => {
  const container = document.querySelector('.giscus');
  if (!container) return;

  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => document.documentElement.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  const config = {
    repo: 'asutoshdash/aiconnector-comments',
    'repo-id': 'R_kgDOVi3SCg',
    category: 'Announcements',
    'category-id': 'DIC_kwDOVi3SCs4DKYWj',
    mapping: 'pathname',
    strict: '1',
    'reactions-enabled': '1',
    'emit-metadata': '0',
    'input-position': 'top',
    theme: theme(),
    lang: 'en',
    loading: 'lazy',
  };
  Object.entries(config).forEach(([key, value]) => script.setAttribute(`data-${key}`, value));

  function syncTheme() {
    script.setAttribute('data-theme', theme());
    container.querySelector('iframe')?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: theme() } } },
      'https://giscus.app'
    );
  }

  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  systemTheme.addEventListener('change', syncTheme);
  // The reader may switch themes before the lazy iframe finishes loading.
  new MutationObserver(() => {
    const frame = container.querySelector('iframe');
    if (frame && !frame.dataset.themeSync) {
      frame.dataset.themeSync = 'true';
      frame.addEventListener('load', syncTheme);
    }
  }).observe(container, { childList: true });

  script.addEventListener('error', () => {
    document.querySelector('.comments-fallback').prepend('Comments could not load. ');
  });
  container.append(script);
})();
