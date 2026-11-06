(() => {
  const aboutURL = new URL('about.html', document.currentScript.src);
  const inlineForm = document.querySelector('#enquiry-form');
  let dialog;
  let loading = false;
  let loaded = false;
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'connect-launcher';
  launcher.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 12h8"/></svg><span>Let’s connect</span>';
  document.body.append(launcher);

  if (inlineForm) {
    initialiseForm(inlineForm);
    launcher.addEventListener('click', () => {
      inlineForm.querySelector('input').focus({ preventScroll: true });
      document.querySelector('#contact').scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    });
    return;
  }

  dialog = document.createElement('dialog');
  dialog.id = 'connect-dialog';
  dialog.className = 'connect-dialog';
  dialog.setAttribute('aria-labelledby', 'connect-title');
  dialog.innerHTML = `<header class="connect-heading"><div><p class="connect-kicker">Learn. Build. Transform.</p><h2 id="connect-title">Let’s connect</h2></div><button type="button" class="connect-close" aria-label="Close enquiry form" autofocus>×</button></header><div class="connect-content"><p class="connect-intro">Build your skills, explore a use case, or bring agentic AI to your team.</p><p class="connect-loading" role="status">Loading the form…</p><div class="connect-form-slot"></div><p class="enquiry-note">Prefer email? <a href="mailto:asutoshd@aiconnector.ai">Contact Asutosh directly</a>.</p></div>`;
  document.body.append(dialog);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', dialog.id);
  dialog.querySelector('.connect-close').addEventListener('click', () => dialog.close());
  launcher.addEventListener('click', async () => {
    if (typeof dialog.showModal !== 'function') {
      location.href = aboutURL.href + '#contact';
      return;
    }
    dialog.showModal();
    if (loaded || loading) return;
    loading = true;
    const message = dialog.querySelector('.connect-loading');
    message.textContent = 'Loading the form…';
    try {
      const response = await fetch(aboutURL, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Unable to load form');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const form = page.querySelector('#enquiry-form');
      if (!form) throw new Error('Form missing');
      dialog.querySelector('.connect-form-slot').append(document.importNode(form, true));
      initialiseForm(dialog.querySelector('form'));
      message.remove();
      loaded = true;
    } catch {
      message.textContent = 'The form could not load. Close and reopen to retry, or ';
      const fallback = document.createElement('a');
      fallback.href = aboutURL.href + '#contact';
      fallback.textContent = 'visit the About page';
      message.append(fallback, '.');
    } finally {
      loading = false;
    }
  });

  function initialiseForm(form) {
    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector('#enquiry-status');
    const verification = document.querySelector('#enquiry-verification');
    let widgetId;
    let token = '';
    let busy = false;
    const invalidate = message => { token = ''; verification.textContent = message; };

    window.onEnquiryTurnstileLoad = () => {
      verification.textContent = 'Complete the verification check before sending.';
      widgetId = window.turnstile.render('#enquiry-turnstile', {
        sitekey: '0x4AAAAAAF149DvofldOGZyc',
        action: 'enquiry',
        size: 'flexible',
        callback: value => { token = value; verification.textContent = 'Verification complete.'; },
        'expired-callback': () => invalidate('Verification expired. Please complete the check again.'),
        'timeout-callback': () => invalidate('Verification timed out. Please try the check again.'),
        'error-callback': () => {
          invalidate('Verification is unavailable. Please reload or contact Asutosh by email.');
        },
      });
      button.disabled = false;
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (!token) {
        status.textContent = 'Please complete the verification check before sending.';
        status.focus();
        return;
      }
      busy = true;
      button.disabled = true;
      button.textContent = 'Sending…';
      form.setAttribute('aria-busy', 'true');
      status.textContent = '';
      const payload = Object.fromEntries(new FormData(form));
      payload['cf-turnstile-response'] = token;
      payload.source_page = window.location.origin + window.location.pathname;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true || (!Number.isSafeInteger(result.id) || result.id < 1)) {
          status.textContent = response.status === 403
            ? 'Verification could not be confirmed. Please complete the new check and try again.'
            : 'Your enquiry could not be saved. Please try again or contact Asutosh by email.';
        } else {
          form.reset();
          status.textContent = `Thank you. Your enquiry has been saved for Asutosh to review. Reference: ${result.id}`;
        }
      } catch {
        status.textContent = 'We could not confirm delivery. Your details are still here. Please try again or contact Asutosh by email.';
      } finally {
        clearTimeout(timeout);
        invalidate('Please complete verification before sending another enquiry.');
        if (widgetId !== undefined) window.turnstile.reset(widgetId);
        busy = false;
        button.disabled = false;
        button.textContent = 'Send enquiry';
        form.removeAttribute('aria-busy');
        if (!dialog || dialog.open) status.focus();
      }
    });

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onEnquiryTurnstileLoad&render=explicit';
    script.async = true;
    script.onerror = () => invalidate('Verification could not load. Please reload or contact Asutosh by email.');
    document.head.append(script);
  }
})();
