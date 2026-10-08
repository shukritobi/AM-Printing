# A&M Craft & Brew V2 (staging)

Cloudflare Workers + static assets + D1 + private R2 for the existing A&M printing storefront.

## Status
Phase 1 implementation is a quote-request workflow, not a live payment checkout. There is **no live payment collection** and no automatic payouts. Never use sample or placeholder database IDs to deploy production.

- Customer orders are submitted server-side and stored in D1.
- Prices are *estimates* and require owner confirmation.
- Owners can sign into the V2 admin UI, view orders, set production status and confirm a quote.
- Customers can track a submitted order with a private access token returned once at submission.
- Artwork uploads go into a private R2 bucket (10 MB per file limit for the first iteration).
- Affiliate records and commission ledger exist in D1; commission is **not** accrued until real payment reconciliation is implemented.
- Public website assets reuse the original branding and styling.

## Local setup
From this folder:

1. npm install
2. Copy .dev.vars.example to .dev.vars and replace both secrets.
3. npm run db:migrate:local
4. npm run dev
5. Open http://localhost:8787 and http://localhost:8787/admin.html

The D1 database id in wrangler.jsonc is a deliberately invalid placeholder. Create a **new**, isolated Cloudflare D1 database using 'npx wrangler d1 create amcraft-v2' and replace the ID before deploying. Create a **private** R2 bucket using 'npx wrangler r2 bucket create amcraft-v2-artworks'. Never reuse the production D1 database for staging.

Run 'npm run typecheck' before deploying.

## Production safety checklist
- Set ADMIN_PASSWORD and SESSION_SECRET with 'npx wrangler secret put ...' for the staging Worker.
- Protect '/api/admin/login' via Cloudflare WAF rate limiting, Turnstile or Access policy before internet exposure.
- Use HTTPS, a dedicated staging hostname, and avoid exposing customer details in public responses.
- Configure environment-specific names/IDs, and never set placeholder R2/D1 bindings live.
- The frontend includes no payment SDK. Confirm **Cheq vs CHIP** and approved split-payment capabilities before integrating.
- Implement order reconciliation and append-only commissions after signed payment provider webhooks.
- Confirm affiliate attribution and owner payout policies before enabling automated commission records.
- The original repository root still deploys from main via GitHub Pages. V2 lives exclusively under /v2 on the development branch.
