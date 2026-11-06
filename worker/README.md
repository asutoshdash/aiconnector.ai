# AIConnector enquiries

This source replaces the starter handler in the existing Worker
`divine-fire-1c46` at `https://divine-fire-1c46.pasutosh.workers.dev`.
The form lives at `about.html#contact` and sends JSON to `POST /enquiries`.
No email notifications are sent. Enquiries are stored in D1 for the owner to read
through the authenticated Cloudflare dashboard. There is no public read endpoint.

## Cloudflare configuration

1. Reuse the existing `aiconnector-enquiries` D1 database and its `enquiries`
   table. `schema.sql` records the supplied schema; no migration or recreation
   is needed. SQLite generates the integer ID, timestamp, and `new` status.
   Consent is required by the handler but is not stored as a separate column.
2. Bind this database to the existing Worker with binding name `ENQUIRIES`.
   For CLI deployments, also add the resulting database ID to `wrangler.jsonc`:

   ```json
   "d1_databases": [{
     "binding": "ENQUIRIES",
     "database_name": "aiconnector-enquiries",
     "database_id": "<actual database ID>"
   }]
   ```

3. Configure the variables in `wrangler.jsonc`. Production allows exactly
   `https://aiconnector.ai` and `https://www.aiconnector.ai`, and verifies the
   corresponding hostnames. Do not add localhost to the production allowlists.
4. Confirm the existing Turnstile widget with sitekey
   `0x4AAAAAAF149DvofldOGZyc` allows `aiconnector.ai` and `www.aiconnector.ai`.
   Preserve its current clearance mode. Store its secret as the Worker secret
   `TURNSTILE_SECRET`, never as a plaintext variable, source file, or chat message.
5. The owner deployed this handler to the existing Worker through the dashboard.
   Publish the static site files through the site's normal deployment process.
   The Worker endpoint has passed CORS and invalid-token rejection checks; a real
   human-verified submission and D1 write remain to be confirmed.

For agent-assisted secret recovery, follow the existing-widget flow at
https://developers.cloudflare.com/turnstile/spin/prompt.md. Approve a canonical
Wrangler executable outside this project (version 4.109 or later), its exact
version, account, domains, config and destination before any secret-bearing getter
or write. Pin the account, confirm the existing Worker with `secret list`, disable
disk/debug logs, validate the secret through Siteverify and pipe it to `secret put`.
Never retrieve the secret through a project-local executable or `npx`.

## Checks

Run `node --test worker/index.test.mjs` from the site root. These are local tests
with simulated Cloudflare responses, a simulated D1 binding, and a real local
SQLite schema compatibility check (requires Python 3). They do not prove a live
D1 write succeeds.

After deployment, submit an enquiry on the real site using a fresh Turnstile
token. Confirm a 201 response and the matching row in D1. Repeat the request with
the same token: it must return 403 without another row. Check a disallowed origin
and an invalid token are rejected. Real-token and live D1 validation are pending
until the account and secret are configured.

The Worker fails closed when the secret, hostname allowlist, or D1 binding is
missing. Invalid/expired/replayed tokens, wrong actions/hostnames, and verification
outages cannot reach the insert. Database failures never produce a success message.
The browser resets its widget after each attempt and preserves fields on failure.

## Reading and deleting enquiries

In Cloudflare's authenticated D1 console:

```sql
SELECT id, created_at, name, email, organisation, interest, message, source_page, status
FROM enquiries ORDER BY created_at DESC LIMIT 100;
```

Handle deletion requests using the enquiry reference ID and a parameterized query
or the dashboard's database tools. Do not add an unauthenticated endpoint for
viewing or deleting personal data. Tokens and IP addresses are not stored, and
the handler does not log enquiry bodies or secrets.
