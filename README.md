# cruzycabs

Next.js booking and operations website for https://cruzycabs.co.nz. Confirmed contact: 027 266 1398, operations@cruzycabs.co.nz. **Bookings open 24/7**; availability requires confirmation.

## Develop

Use Node 24 and the pinned pnpm version. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, configure local test settings, then `pnpm dev`. Next reads `.env.local`; legacy Cloudflare `.dev.vars` instructions do not configure this release path. Never commit secrets or use production records for local fixtures. Read `AGENTS.md` and the installed Next documentation before changes.

## Current architecture and launch

Vercel/Next.js → Turso/libSQL; private Vercel Blob for compliance evidence. Production new booking requests require explicit `BOOKINGS_ENABLED=true` after acceptance; rebuild when activating. Existing management/cancellation and enquiries remain available while new requests pause. Payment opens only after a suitable driver accepts. Stripe test configuration is not live approval.

[CURRENT-OPERATIONS.md](CURRENT-OPERATIONS.md) is the current activation, scheduling, refund exception, backup/restore and rollback procedure. [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) records gates. [WEBSITE-AUDIT.md](WEBSITE-AUDIT.md) contains acceptance criteria and fix status. Older deployment/design/SEO reports are historical records.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Tests use isolated SQLite and mocked providers; no real charges, messages, refunds or assignments. Local browser evidence is separated from hosted/provider-backed acceptance.
