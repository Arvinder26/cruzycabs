# Vercel deployment status

Updated 7 October 2026. Hosting target is now Vercel, as requested.

## Prepared

- Vercel project: cruzycabs, team arvinder, project ID prj_SlbGRNAoZ4gnrnopHEgLtfXhNNXz, Sydney region, Node 24.
- Standard Next.js 16.3.8 build and Node API routes. Default pnpm dev/build/start now use Next.js.
- Turso/libSQL adapter retains the existing SQLite SQL and atomic batches. Cloudflare bindings remain injectable for the legacy Worker entry; its build is not the Vercel release path.
- Private Vercel Blob adapter for compliance documents. It never creates public document URLs.
- Next.js security and privacy headers. Authenticated GET /api/jobs supports CRON_SECRET; POST supports JOBS_SECRET.
- 22 tests passed, including real libSQL local adapter rollback. Next.js production build, TypeScript and lint passed before the last runtime declaration correction; final checks should be repeated before release.

## Account setup needed

1. Create private GitHub repository Arvinder26/cruzycabs with an initial README. Share its URL and ensure the connector can access it. Existing unrelated repositories will not be used.
2. Create a hosted Turso database. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN directly in Vercel project environment settings, using separate preview/production databases. Do not paste tokens into chat. Existing SQLite schema is compatible; apply the two drizzle SQL files to a fresh database, or allow the app's additive core/application schema initialisation on first API request. Back up any existing database before changing it.
3. In the project's Storage tab, create and attach a PRIVATE Blob store named cruzycabs-compliance. The connector returned permission denied for Blob creation; the local Vercel CLI has no usable credentials. Confirm BLOB_READ_WRITE_TOKEN is attached to the required environments.
4. Configure APP_SIGNING_SECRET, jobs/cron secrets, staff roles/TOTP and provider settings from .env.example. Keep signing secret stable. LOCAL_PREVIEW must be false on Vercel.
5. Use a supported scheduler to invoke the jobs endpoint every minute. Native minute-frequency Vercel Cron requires an eligible plan; no paid upgrade or cron schedule has been enabled automatically. Do not open live bookings until background recovery is configured.
6. Connect the GitHub repository to the existing Vercel project. Deploy and verify a protected preview with real storage before promoting. Configure SITE_URL for the tested URL and use the production domain when it is connected.
7. Add cruzycabs.co.nz in Vercel Domains and copy the exact supplied DNS records to Squarespace. Preserve Google Workspace MX/TXT email records; changing website hosting does not require changing mail hosting.

Stripe, maps, Resend, legal details and operational sign-off remain required for a real booking service. Creating the Vercel project does not mean the app is deployed.

## Deployment progress

The code is uploaded to private repository https://github.com/Arvinder26/cruzycabs using existing Git credentials. The original GitHub connector remains unable to see the new private repository; this did not prevent the Git upload or Vercel Git-source deployment.

Vercel successfully built deployment dpl_A2DSqTiGyBBxTve2n4yEfKyQ5sSB from commit 9c3970f. A final follow-up release adds clear activation messaging when storage is absent and trusted platform origins. Base settings and encrypted signing/jobs secrets are provisioned; no secrets are committed.

cruzycabs.co.nz and www.cruzycabs.co.nz are attached to the Vercel project. Squarespace DNS changes are still needed. Do not change Google Workspace MX/TXT records. Vercel Blob creation was denied by the connector and local CLI; a hosted Turso database and provider credentials are still absent. The deployed public pages are a website preview, not an active booking service.
