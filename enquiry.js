(() => {
  const form = document.querySelector('#enquiry-form');
  if (!form) return;
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
      status.focus();
    }
  });

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onEnquiryTurnstileLoad&render=explicit';
  script.async = true;
  script.onerror = () => invalidate('Verification could not load. Please reload or contact Asutosh by email.');
  document.head.append(script);
})();
