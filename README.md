# A&M Craft & Brew Printing Website

A responsive customer website and browser-based order management demo for A&M Craft & Brew Enterprise.

## Live pages

- Customer website: `index.html`
- Admin dashboard: `admin.html`

## Included features

### Customer website
- Product catalogue for Sampul Raya, stickers, photo printing, polaroid prints and custom cards
- Responsive custom order form
- Automatic estimate calculator
- Artwork file selection
- Local order creation with unique order IDs
- Order tracking from the same browser
- Sampul Raya 2027 waiting-list form
- Shopee, Threads and email links
- Mobile navigation and accessible modal interactions

### Admin dashboard
- Business overview and metrics
- Orders table with search and status filters
- Production Kanban board
- Order status updates
- Payment status control
- Customer grouping
- Worker assignment demo
- CSV export
- Manual order entry
- Sample-data generator

## Important deployment note

This GitHub Pages version is a functional front-end demo. GitHub Pages only hosts static files, so orders, customer details and waiting-list entries are stored in `localStorage` on each visitor's browser. They are not shared between devices.

For real production use, connect the front end to Supabase, Firebase or another secure backend. Recommended production work:

1. Supabase PostgreSQL database
2. Supabase Auth for admin login
3. Row Level Security policies
4. Supabase Storage or Cloudflare R2 for artwork uploads
5. Malaysian payment gateway integration
6. WhatsApp Cloud API or transactional email notifications
7. Privacy, consent and file-retention policy

## Contact values to verify

The site currently uses:

- Email: `amcraftbrew@gmail.com`
- Shopee: `https://shopee.com.my/amcraftbrewenterprise`
- Threads: `https://www.threads.net/@norareenaibnizul`

Update these before presenting the site as final production software.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the repository root whenever `main` is updated. The expected project URL is:

`https://shukritobi.github.io/AM-Printing/`
