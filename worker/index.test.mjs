import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import worker from './index.mjs';

const origin = 'https://www.aiconnector.ai';
const payload = {
  name: 'Example Visitor', email: 'visitor@example.com', organisation: '',
  interest: 'building_a_poc', message: 'I want to build an agentic POC.', consent: 'yes',
  'cf-turnstile-response': 'test-token',
};
function fixture(t, result = { success: true, action: 'enquiry', hostname: 'www.aiconnector.ai' }) {
  const writes = [];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(result);
  });
  const env = {
    ALLOWED_ORIGINS: `${origin},https://aiconnector.ai`,
    TURNSTILE_HOSTNAMES: 'www.aiconnector.ai,aiconnector.ai', TURNSTILE_SECRET: 'test-secret',
    ENQUIRIES: { prepare: sql => ({ bind: (...values) => ({ run: async () => {
      writes.push({ sql, values }); return { success: true, meta: { last_row_id: writes.length } };
    } }) }) },
  };
  const request = (body = payload, overrides = {}) => new Request('https://worker.example/enquiries', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), ...overrides,
  });
  return { env, writes, calls, request };
}

test('verified enquiry is parameterized, saved once, and returns its reference', async t => {
  const f = fixture(t);
  const response = await worker.fetch(f.request({ ...payload, name: "O'Brien" }), f.env);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(f.writes.length, 1);
  assert.equal(body.id, 1);
  assert.equal(f.writes[0].values[0], "O'Brien");
  assert.equal(f.writes[0].sql.includes("O'Brien"), false);
  assert.equal(f.writes[0].values.includes('test-token'), false);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(f.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(f.calls[0].options.body.get('response'), 'test-token');
});

for (const result of [
  { success: false, 'error-codes': ['timeout-or-duplicate'] },
  { success: 'true', action: 'enquiry', hostname: 'www.aiconnector.ai' },
  { success: true, action: 'login', hostname: 'www.aiconnector.ai' },
  { success: true, action: 'enquiry', hostname: 'localhost' },
  { success: true, action: 'enquiry', hostname: 'aiconnector.ai' },
  null,
]) {
  test(`verification rejects ${JSON.stringify(result)} without saving`, async t => {
    const f = fixture(t, result);
    assert.equal((await worker.fetch(f.request(), f.env)).status, 403);
    assert.equal(f.writes.length, 0);
  });
}

for (const patch of [
  { name: ' ' }, { email: 'not-email' }, { message: ' ' }, { message: 'x'.repeat(5001) },
  { consent: 'no' }, { interest: 'personal' }, { organisation: 42 },
]) {
  test(`invalid input ${Object.keys(patch)} never calls Siteverify or D1`, async t => {
    const f = fixture(t);
    assert.equal((await worker.fetch(f.request({ ...payload, ...patch }), f.env)).status, 400);
    assert.equal(f.calls.length, 0);
    assert.equal(f.writes.length, 0);
  });
}

test('missing/oversized tokens and missing configuration fail closed', async t => {
  const f = fixture(t);
  for (const token of ['', ' ', null, 'x'.repeat(2049)]) {
    assert.equal((await worker.fetch(f.request({ ...payload, 'cf-turnstile-response': token }), f.env)).status, 403);
  }
  for (const key of ['TURNSTILE_SECRET', 'TURNSTILE_HOSTNAMES', 'ENQUIRIES']) {
    assert.equal((await worker.fetch(f.request(), { ...f.env, [key]: undefined })).status, 503);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.length, 0);
});

test('CORS, methods, invalid JSON, and streaming body size are enforced', async t => {
  const f = fixture(t);
  const options = await worker.fetch(f.request(undefined, { method: 'OPTIONS', body: undefined }), f.env);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Methods'), 'POST');
  for (const badOrigin of ['https://evil.example', 'null', 'https://www.aiconnector.ai.evil.example']) {
    const response = await worker.fetch(f.request(undefined, { headers: { Origin: badOrigin } }), f.env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.has('Access-Control-Allow-Origin'), false);
  }
  assert.equal((await worker.fetch(f.request(undefined, { method: 'GET', body: undefined }), f.env)).status, 405);
  assert.equal((await worker.fetch(f.request(undefined, { body: '{' }), f.env)).status, 400);
  assert.equal((await worker.fetch(f.request(undefined, { body: 'x'.repeat(24_001) }), f.env)).status, 413);
  assert.equal((await worker.fetch(f.request(undefined, { headers: { Origin: origin, 'Content-Type': 'text/plain' } }), f.env)).status, 415);
  assert.equal(f.calls.length, 0);
});

test('network, HTTP and malformed verification responses fail closed', async t => {
  const f = fixture(t);
  for (const impl of [
    async () => { throw new Error('timeout'); },
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('not json'),
  ]) {
    globalThis.fetch.mock.mockImplementation(impl);
    assert.equal((await worker.fetch(f.request(), f.env)).status, 403);
  }
  assert.equal(f.writes.length, 0);
});

test('database failure never acknowledges delivery', async t => {
  const f = fixture(t);
  for (const run of [async () => ({ success: false }), async () => { throw new Error('D1 unavailable'); }]) {
    f.env.ENQUIRIES = { prepare: () => ({ bind: () => ({ run }) }) };
    const response = await worker.fetch(f.request(), f.env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false });
  }
});

test('simulated Siteverify replay rejection prevents another write', async t => {
  const f = fixture(t);
  assert.equal((await worker.fetch(f.request(), f.env)).status, 201);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
  assert.equal((await worker.fetch(f.request(), f.env)).status, 403);
  assert.equal(f.writes.length, 1);
});

test('all five interests and schema limits insert into the supplied SQLite schema', async t => {
  const f = fixture(t);
  for (const interest of ['learning_agentic_ai', 'applying_my_knowledge', 'organisation_transformation', 'building_a_poc', 'other']) {
    const response = await worker.fetch(f.request({
      ...payload, interest, name: 'N'.repeat(120), organisation: 'O'.repeat(200),
      message: 'M'.repeat(5000), source_page: `${origin}/about.html?private=value#contact`,
      status: 'closed', id: 999, created_at: 'fake',
    }), f.env);
    assert.equal(response.status, 201);
  }
  assert.equal((await worker.fetch(f.request({ ...payload, organisation: null, message: 'X' }), f.env)).status, 201);
  assert.equal((await worker.fetch(f.request({ ...payload, organisation: undefined }), f.env)).status, 201);
  const python = spawnSync('python3', ['-c', `
import json, sqlite3, sys
data = json.load(sys.stdin)
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.executescript(data['schema'])
for write in data['writes']:
    db.execute(write['sql'], write['values'])
print(json.dumps([dict(row) for row in db.execute('SELECT * FROM enquiries ORDER BY id')]))
`], {
    input: JSON.stringify({ schema: readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'), writes: f.writes }),
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(python.status, 0, python.stderr);
  const rows = JSON.parse(python.stdout);
  assert.equal(rows.length, 7);
  rows.forEach((row, index) => {
    assert.equal(row.id, index + 1);
    assert.equal(row.status, 'new');
    assert.ok(Number.isFinite(Date.parse(row.created_at)));
  });
  assert.equal(rows[0].source_page, `${origin}/about.html`);
  assert.equal(rows[5].organisation, null);
  assert.equal(rows[5].source_page, null);
});

test('schema overflow and untrusted source pages are rejected before verification', async t => {
  const f = fixture(t);
  for (const patch of [
    { name: 'n'.repeat(121) }, { organisation: 'o'.repeat(201) },
    { source_page: 'https://evil.example/' }, { source_page: 'not a URL' },
    { source_page: 42 }, { source_page: origin + '/' + 'x'.repeat(2048) },
  ]) {
    assert.equal((await worker.fetch(f.request({ ...payload, ...patch }), f.env)).status, 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.length, 0);
});
