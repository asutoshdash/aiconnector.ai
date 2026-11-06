const MAX_BODY_BYTES = 24_000;
const split = value => (value || '').split(',').map(item => item.trim()).filter(Boolean);

async function readBody(request) {
  if (!request.body) throw new Error('empty');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = new Set(split(env.ALLOWED_ORIGINS));
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (new URL(request.url).pathname !== '/enquiries') return reply(404, { ok: false });
    if (!origin || !allowed.has(origin)) return reply(403, { ok: false });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type',
      } });
    }
    if (request.method !== 'POST') return reply(405, { ok: false });
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
      return reply(415, { ok: false });
    }
    const hostnames = new Set(split(env.TURNSTILE_HOSTNAMES));
    if (!env.TURNSTILE_SECRET?.trim() || !env.ENQUIRIES || !hostnames.size) return reply(503, { ok: false });
    let body;
    try { body = await readBody(request); }
    catch (error) { return reply(error.message === 'large' ? 413 : 400, { ok: false }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false });
    const text = (key, max, min = 1) => typeof body[key] === 'string' && body[key].trim().length >= min && body[key].length <= max;
    if (!text('name', 120) || !text('email', 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
        (body.organisation != null && !text('organisation', 200, 0)) || !text('message', 5000) ||
        !['learning_agentic_ai', 'applying_my_knowledge', 'organisation_transformation', 'building_a_poc', 'other'].includes(body.interest) || body.consent !== 'yes') {
      return reply(400, { ok: false });
    }
    // Store only a same-origin page path; query strings may contain private data.
    let sourcePage = null;
    if (body.source_page != null && body.source_page !== '') {
      if (!text('source_page', 2048)) return reply(400, { ok: false });
      try {
        const page = new URL(body.source_page);
        if (page.origin !== origin) return reply(400, { ok: false });
        sourcePage = page.origin + page.pathname;
      } catch { return reply(400, { ok: false }); }
    }
    const token = body['cf-turnstile-response'];
    if (typeof token !== 'string' || !token.trim() || token.length > 2048) return reply(403, { ok: false });
    try {
      const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
      const ip = request.headers.get('CF-Connecting-IP');
      if (ip) params.set('remoteip', ip);
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return reply(403, { ok: false });
      const result = await response.json();
      if (result.success !== true || result.action !== 'enquiry' || !hostnames.has(result.hostname) ||
          result.hostname !== new URL(origin).hostname) return reply(403, { ok: false });
    } catch { return reply(403, { ok: false }); }

    let id;
    try {
      const result = await env.ENQUIRIES.prepare(
        'INSERT INTO enquiries (name, email, organisation, interest, message, source_page) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
      ).bind(body.name.trim(), body.email.trim(), body.organisation?.trim() || null,
        body.interest, body.message.trim(), sourcePage).run();
      if (!result.success) return reply(503, { ok: false });
      id = result.meta?.last_row_id;
      if (!Number.isSafeInteger(id) || id < 1) return reply(503, { ok: false });
    } catch { return reply(503, { ok: false }); }
    return reply(201, { ok: true, id });
  },
};
