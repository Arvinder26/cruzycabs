The requested deployment target is now Vercel. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for the current setup; Cloudflare instructions below describe the previous hosting target.

# cruzycabs

Taxi booking and operations website for https://cruzycabs.co.nz. Contact: operations@cruzycabs.com, operating 24/7.

## Develop

Use Node 24 and pnpm 11.16.0. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.dev.vars`, configure local settings, then `pnpm dev`. Local Cloudflare D1 supplies persistence. Never commit secrets. Explicit `LOCAL_PREVIEW=true` allows local staff preview only in development; deployed builds ignore it.

## Implemented

Server-priced Google road routing; expiring quote access; hosted Stripe Checkout; signed payment webhooks and refund recovery; secure guest management; email sign-in and staff TOTP; persisted dispatch and driver transitions; provider-scoped partner access; enquiry cases; account history and saved places; private compliance documents; configurable pricing; email outbox retries; audit records; safe offline page; metadata and security headers.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Tests use in-memory SQLite and mocked providers, so they do not charge cards or send external emails.

See [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) for activation and remaining dependencies. Passing local checks does not activate production services.

