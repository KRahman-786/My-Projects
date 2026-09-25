# Kashif Collection — Full-Stack E-commerce

Online store for **Kashif Collection** (Near Eidgah, Kamran Market, Shahjahanpur, Uttar Pradesh) selling **Cosmetics**, **Lace** and **Artificial Jewellery**.

It is a working application: a Next.js storefront and admin, an Express REST API, a PostgreSQL database managed with Prisma, cookie-based authentication, a persistent cart, inventory reservation, coupons, Razorpay, Stripe and Cash on Delivery payments (all verified server-side), returns and refunds, reviews, GST invoices and an analytics dashboard.

---

## Contents

1. [Architecture](#architecture)
2. [Technology stack](#technology-stack)
3. [Folder structure](#folder-structure)
4. [Database design (ERD)](#database-design-erd)
5. [Key business flows](#key-business-flows)
6. [Installation](#installation)
7. [Environment variables](#environment-variables)
8. [Development commands](#development-commands)
9. [Testing](#testing)
10. [Payments: test setup](#payments-test-setup)
11. [Admin login](#admin-login)
12. [API reference](#api-reference)
13. [Production build & deployment](#production-build--deployment)
14. [Security](#security)
15. [Performance & SEO](#performance--seo)
16. [Troubleshooting](#troubleshooting)
17. [Known limitations](#known-limitations)
18. [Recommended next improvements](#recommended-next-improvements)

---

## Architecture

```
 Browser ──► Next.js (frontend, :3000)
               │  • Server components render catalogue pages (SEO) by calling the API directly
               │  • /api/* route handler = same-origin proxy to the API (first-party session cookie,
               │    forwards the visitor IP with a shared secret for per-visitor rate limiting)
               ▼
            Express REST API (backend, :4000)
               │  routes → controllers → services → Prisma
               │  • zod validation, auth/RBAC, CSRF header, rate limits, helmet, central errors
               │  • pricing / tax / shipping / coupon / inventory / order / payment services
               ▼
            PostgreSQL (Prisma migrations, CHECK constraints for stock invariants)

 Razorpay / Stripe ──webhooks──► API /api/payments/{razorpay|stripe}/webhook   (direct, not via the proxy)
 Cloudinary ◄── admin image uploads (API streams the file; only URL + public_id stored in PostgreSQL)
```

Design decisions:

- **The frontend never talks to the database.** All data flows through the REST API.
- **Money is integer paise** everywhere (`₹1 = 100`), so there are no floating-point errors. The admin UI edits rupees and converts them.
- **One pricing engine** (`backend/src/services/pricing.service.ts`) computes cart, checkout preview and order totals from database prices. The client never supplies prices. The browser sends its displayed total only as `expectedTotal`, and a mismatch is refused with `PRICE_CHANGED`.
- **Orders snapshot** product names, prices, tax and address so history never changes when the catalogue does. Products are soft-deleted.
- **Service-layer architecture.** Route files only wire middleware to controllers. Controllers are thin, and all business rules live in services.

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS 3, TanStack Query, Recharts, Stripe Elements, lucide icons |
| Backend | Node.js 20+, Express 5, TypeScript (strict), zod 4, Prisma 6, bcryptjs, jsonwebtoken, helmet, express-rate-limit, multer, pdfkit, nodemailer |
| Database | PostgreSQL 14+ (developed on 16) |
| Payments | Razorpay Orders + Checkout (signature + webhook), Stripe PaymentIntents + Payment Element (server retrieval + webhook), COD |
| Images | Cloudinary (auto format/quality). Local-disk fallback in development only |
| Tests | Vitest + Supertest against a real PostgreSQL test database; Playwright browser smoke test |

## Folder structure

```
kashif-collection/
├── docker-compose.yml            # local PostgreSQL (optional)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # normalized schema (32 models)
│   │   ├── migrations/           # Prisma migrations (+ CHECK constraints / partial unique index)
│   │   ├── seed.ts               # dev seed (uses the real services)
│   │   ├── seed-data.ts          # categories, 30 products, customers, review texts
│   │   └── generate-placeholder-images.ts
│   ├── src/
│   │   ├── app.ts / server.ts    # express app factory / process entry
│   │   ├── config/               # env (validated), prisma, logger, business identity
│   │   ├── routes/               # index.ts (public + customer), admin.routes.ts, auth.routes.ts
│   │   ├── controllers/          # thin HTTP adapters
│   │   ├── services/             # business logic
│   │   │   ├── pricing / tax / coupon / cart / wishlist / order / inventory / returns
│   │   │   ├── payments/         # razorpay.gateway, stripe.gateway, payment.service
│   │   │   ├── shipping/         # provider interface + standard provider + registry
│   │   │   └── invoice / dashboard / review / storage / mailer / notification / settings …
│   │   ├── middleware/           # auth, csrf, clientIp, rateLimit, validate, upload, errorHandler
│   │   ├── validators/           # zod schemas
│   │   ├── jobs/                 # unpaid-order expiry scheduler (+ one-shot CLI)
│   │   └── utils/                # AppError, response envelope, pagination, money, crypto
│   └── tests/                    # 76 integration/unit tests
└── frontend/
    ├── app/
    │   ├── (shop)/               # storefront pages (home, listing, product, cart, checkout, account, policies …)
    │   ├── admin/                # admin dashboard (server-side ADMIN check in layout)
    │   ├── api/[...path]/        # same-origin proxy to the API
    │   ├── sitemap.ts, robots.ts, layout.tsx, not-found.tsx
    ├── components/               # ui/, layout/, product/, listing/, cart/, checkout/, account/, admin/, home/, providers/
    ├── services/                 # typed API clients (catalog, account, admin)
    ├── hooks/, lib/, types/, utils/
    ├── e2e/storefront.e2e.mjs    # browser smoke test
    └── public/images/            # generated placeholder product art
```

## Database design (ERD)

```
User 1─* Address            User 1─1 Cart 1─* CartItem *─1 ProductVariant
User 1─1 Wishlist 1─* WishlistItem *─1 Product
User 1─* Order 1─* OrderItem *─1 ProductVariant *─1 Product
                  Order 1─* Payment 1─* Refund
                  Order 1─* OrderStatusHistory
                  Order 1─0..1 CouponUsage *─1 Coupon
                  Order 1─* Return 1─* Refund
Category 1─* Subcategory 1─* Product 1─* ProductImage / ProductSpecification / ProductVariant / Review
ProductVariant 1─1 Inventory 1─* InventoryTransaction (audit trail, links Order & admin User)
Coupon *─* Category (CouponCategory)   Coupon *─* Product (CouponProduct)
Review 0..1─1 OrderItem (verified purchase; unique → one review per order item)
Notification *─0..1 User (null user = admin notification)
StoreSettings (singleton), ServiceablePincode, OrderCounter (per-year order numbers),
WebhookEvent (processed gateway event ids), PasswordResetToken, ContactMessage
```

- **Role** is a PostgreSQL enum (`CUSTOMER`, `ADMIN`) on `User`. An enum keeps RBAC simple and type-safe. A `Role`/`Permission` table can replace it if fine-grained permissions are ever needed.
- **Inventory** keeps `totalStock`, `reservedStock` and `availableStock`. Database CHECK constraints enforce `total = reserved + available` and that none are negative.
- Every stock movement (`RESTOCK`, `ADJUSTMENT`, `RESERVE`, `RELEASE`, `SALE`, `RETURN`, `CANCEL_RESTOCK`) is written to `InventoryTransaction`.
- Indexes cover category/status/price/discount/rating/popularity/created filters, a GIN index covers tags, and composite indexes cover order listing and expiry scans. A partial unique index allows only one default address per user.
- Soft delete (`deletedAt`) applies to products, variants, categories, subcategories, coupons and users. The slug and SKU are suffixed on delete so they can be reused.

## Key business flows

**Checkout.** The flow is Cart → Address → Shipping → Payment → Confirmation. `POST /api/orders` does the following:
1. Re-prices the database cart strictly. It checks that the product/variant exists and is active, that stock is available, the current price, coupon validity, pincode serviceability and COD limits.
2. Compares the total with `expectedTotal`.
3. In **one transaction**, creates the order and its snapshot, **reserves stock** with a conditional `UPDATE … WHERE availableStock >= qty`, and consumes the coupon. The coupon step uses an advisory lock plus a conditional usage increment.

The row lock taken by the conditional UPDATE means two buyers of the last unit are serialized, so one succeeds and the other gets `OUT_OF_STOCK`.

**COD:** the order is `CONFIRMED` with payment `PENDING`. Stock is committed (reserved → sold) immediately and the bag is cleared. The payment becomes `PAID` when the admin marks the order `DELIVERED`.

**Online (Razorpay/Stripe):** the order is created as `PENDING` with a reservation window (default 30 minutes). The API then creates the gateway order or PaymentIntent. The order becomes **PAID only after server-side verification**:
- **Razorpay:** HMAC signature check of `order_id|payment_id`, or a signed webhook (`payment.captured` / `order.paid`).
- **Stripe:** the API re-fetches the PaymentIntent from Stripe (the client's result is ignored), or a signed webhook (`payment_intent.succeeded`).

`markOrderPaid` is idempotent and row-locked, so duplicate callbacks and webhooks are harmless. Processed webhook ids are stored in `WebhookEvent`.

**Payment edge cases:**
- **Payment fails:** the payment is marked `FAILED`. The order stays reserved so the customer can retry from *My Orders* until the window expires.
- **Paid, but the browser closed:** the webhook confirms the payment. If the webhook is also lost, the expiry job **reconciles with the gateway** before releasing stock.
- **Late payment after expiry:** the order is revived if stock is still available. Otherwise a pending **refund** is created and the admin is notified.
- **Duplicate payment on an already-paid order:** a refund is created.
- **"Payment succeeds but order creation fails"** cannot happen: the order and reservation exist *before* any money moves.

**Cancellations & returns:**
- Customers can cancel orders that are `PENDING`, `CONFIRMED`, `PAID` or `PROCESSING`. Admins can also cancel `PACKED` orders.
- Cancellation releases or restocks inventory and restores the coupon. For paid orders it creates a refund.
- Returns are allowed within the return window after delivery. The admin approves the return, then marks it received, which restocks the items and creates a refund. Shipping and COD fees are not refunded on returns.
- Refunds go back through the Razorpay or Stripe refund API. COD refunds are recorded with a bank/UPI reference.

**Order status machine (admin):**
- `CONFIRMED|PAID → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED` (`SHIPPED → DELIVERED` is also allowed).
- `CANCELLED` is reachable up to `PACKED`.
- `PAID` is set only by payment verification. Invalid transitions return `INVALID_STATUS_TRANSITION`.

**Tax.** `tax.service.ts` is the only place that computes GST:
- Prices are GST-inclusive by default (a store setting), and each line's tax is extracted at the product's rate after its coupon share.
- Delivery inside the seller's state is billed CGST + SGST. Delivery to other states is billed IGST.

**Shipping.** `shipping/types.ts` defines a `ShippingProvider` interface (serviceability, rate, create shipment, tracking URL). The `standard` provider works as follows:
- A flat fee applies, with a free-shipping threshold.
- Pincode overrides come from the `serviceable_pincodes` table. Other pincodes use zone rules for the delivery estimate.

To add Shiprocket, Delhivery or India Post, implement the interface and register the provider in `shipping.service.ts`. The order flow does not change.

## Installation

Prerequisites: **Node.js 20+** and **PostgreSQL 14+**. Docker is optional and only used for the database.

```bash
cd kashif-collection

# 1. Database — either use Docker…
docker compose up -d
# …or create it yourself:
#   CREATE USER kashif WITH PASSWORD 'kashif_dev' CREATEDB;
#   CREATE DATABASE kashif_collection OWNER kashif;
#   CREATE DATABASE kashif_shadow OWNER kashif;          -- for prisma migrate dev
#   CREATE DATABASE kashif_collection_test OWNER kashif; -- for the test suite

# 2. Backend
cd backend
cp .env.example .env            # set JWT_SECRET (and PROXY_SHARED_SECRET)
npm install
npx prisma migrate deploy       # apply migrations
npm run db:seed                 # demo catalogue, customers, orders, coupons, reviews
npm run dev                     # http://localhost:4000/api/health

# 3. Frontend (new terminal)
cd ../frontend
cp .env.example .env.local      # set PROXY_SHARED_SECRET to the same value as the backend
npm install
npm run dev                     # http://localhost:3000
```

To regenerate the placeholder product art, run `cd backend && npx tsx prisma/generate-placeholder-images.ts`.

## Environment variables

**Backend (`backend/.env`)**. See `backend/.env.example` for comments.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | ≥ 32 random characters. The API refuses to start in production with a dev-looking value |
| `FRONTEND_URL` | ✅ | Storefront origin (CORS + reset links) |
| `PROXY_SHARED_SECRET` | recommended | Must equal the frontend's value. Enables per-visitor rate limiting through the proxy |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for Razorpay | Test keys `rzp_test_…` |
| `RAZORPAY_WEBHOOK_SECRET` | for Razorpay webhooks | Webhook secret set in the Razorpay dashboard |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | for Stripe | `sk_test_…` / `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | for Stripe webhooks | `whsec_…` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | production | Image storage (dev falls back to `backend/uploads/`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | Email. Without it, emails such as reset links are printed to the API log |
| `ADMIN_NOTIFICATION_EMAIL` | optional | Copies admin notifications by email |
| `BUSINESS_GSTIN` | optional | Printed on invoices |
| `API_PUBLIC_URL`, `CORS_ORIGINS`, `COOKIE_DOMAIN`, `TRUST_PROXY`, `ENABLE_JOBS`, `SHIPPING_PROVIDER`, `JWT_EXPIRES_IN_DAYS` | optional | See `.env.example` |

**Frontend (`frontend/.env.local`)**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, Open Graph, sitemap |
| `NEXT_PUBLIC_API_URL` | API base for the browser. Keep the default `/api` (the same-origin proxy) |
| `API_INTERNAL_URL` | Where the Next server reaches the API (runtime) |
| `PROXY_SHARED_SECRET` | Server-only. Must match the backend |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional. The API already serves the publishable key |

Secret keys (`DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, webhook and Cloudinary secrets) exist **only in the backend**. Nothing secret uses the `NEXT_PUBLIC_` prefix.

## Development commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | API with hot reload (tsx) |
| backend | `npm run prisma:migrate` | Create/apply a migration after editing `schema.prisma` (dev) |
| backend | `npm run prisma:deploy` | Apply migrations (CI/production) |
| backend | `npm run db:seed` | **Wipes** and re-seeds the dev database (refuses in production) |
| backend | `npm run typecheck` | Strict TypeScript check |
| backend | `npm test` | Test suite (uses `.env.test` → `kashif_collection_test`) |
| backend | `npm run jobs:expire-orders` | One-off run of the unpaid-order expiry job |
| frontend | `npm run dev` | Next.js dev server |
| frontend | `npm run typecheck` / `npm run lint` | TS / ESLint |
| frontend | `npm run e2e` | Browser smoke test (needs a running, seeded stack and `CHROMIUM_PATH`) |

## Testing

`cd backend && npm test` runs **76 tests** against a real PostgreSQL database. Migrations are applied automatically. Only the network calls to Razorpay and Stripe are replaced with fakes; all signature, webhook and verification code is real.

| Area | What is covered |
|---|---|
| Authentication | Register/login/logout, hashing, HTTP-only cookie, deactivated accounts, session revocation on password change, forgot/reset (single-use token, no user enumeration), CSRF header |
| Admin authorization | Customers/anonymous blocked; no password hashes in admin views |
| Product API | Pagination, filters (category, rupee price range, colour, availability), sorting, search by name/SKU/tag/category, suggestions, 404 shape |
| Cart & coupons | Server-side prices, stock validation, price changes, unavailable items, guest quote + merge, free shipping, percentage/fixed/min-cart/max-discount/expired/not-started/usage and per-user limits, category-scoped allocation |
| Checkout & COD | Order creation, sequential `KC-YYYY-NNNNNN` numbers, idempotency, **price changed before checkout**, **out of stock during checkout**, **coupon expires during checkout**, coupon release on cancel, pincode/COD limits, **two users buying the last unit simultaneously**, reservation expiry, ownership, invoice PDF |
| Razorpay | Signature verification (unit), forged success rejected, verified payment → PAID + stock committed, **duplicate callbacks**, **webhook when the frontend disconnects**, **duplicate webhooks**, **payment failure + retry**, failure webhook cannot undo success, **reconciliation of a captured-but-unreported payment**, late payment revival, **late payment when stock is gone → refund**, unknown orders |
| Stripe | PaymentIntent creation, client claim not trusted, server-verified success, failure, webhook signature verification + dedupe |
| Admin | Product CRUD with variants/stock audit, price validation, soft delete preserving history, category rules, status machine, cancellation restock, order search, full return → restock → refund flow, gateway refund, stock adjustments + history + low-stock, customer deactivation, review moderation + rating recalculation, dashboard, settings |
| Security | Proxy IP trust, secure headers, no stack traces, malformed JSON, CORS allow-list |

## Payments: test setup

### Razorpay (test mode)
1. Create a Razorpay account. In **Dashboard → switch to Test Mode → Settings → API Keys**, generate a key pair and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Webhooks: in **Settings → Webhooks**, add `https://<your-api-domain>/api/payments/razorpay/webhook` with the events `payment.captured`, `order.paid`, `payment.failed` and `refund.processed`, and set a secret as `RAZORPAY_WEBHOOK_SECRET`. For local testing, expose port 4000 with a tunnel such as `ngrok http 4000` or `cloudflared tunnel`.
3. At checkout, choose **UPI, Cards, Wallets & Net Banking**. Test card: `4111 1111 1111 1111`, any future expiry, any CVV, OTP as prompted. Test UPI: `success@razorpay` (use `failure@razorpay` to test failures).

### Stripe (test mode)
1. From **Developers → API keys (test)**, set `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_PUBLISHABLE_KEY=pk_test_…`.
2. Local webhooks: run `stripe listen --forward-to localhost:4000/api/payments/stripe/webhook` and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. In production, add the endpoint in the dashboard with the events `payment_intent.succeeded` and `payment_intent.payment_failed`.
3. Test cards: `4242 4242 4242 4242` (success), `4000 0025 0000 3155` (3-D Secure), `4000 0000 0000 9995` (declined). Use any future date and CVC.
4. The API creates PaymentIntents in INR. Your Stripe account must support INR; Indian Stripe accounts have extra requirements for live mode.

If a gateway's keys are missing, that method is shown as **unavailable** at checkout and the API returns `PAYMENT_GATEWAY_NOT_CONFIGURED`. COD always works, subject to the COD settings.

## Admin login

After `npm run db:seed` (development only):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@kashifcollection.in` | `Admin@12345` |
| Customers | `priya@`, `aisha@`, `neha@`, `fatima@`, `rohan@example.com` | `Customer@123` |

Open **http://localhost:3000/admin**. The admin layout verifies the ADMIN role on the server, and every `/api/admin/*` endpoint requires `requireAuth + requireRole('ADMIN')`.

**Production:** never run the seed. Create the first admin with a strong password, for example:
```bash
cd backend
node -e "require('bcryptjs').hash(process.argv[1],12).then(console.log)" 'YOUR-STRONG-PASSWORD'
# then in psql:
# INSERT INTO users (id,name,email,"passwordHash",role,"updatedAt") VALUES ('admin1','Owner','you@yourdomain.in','<hash>','ADMIN',now());
```
Alternatively, register normally on the site and promote the account: `UPDATE users SET role='ADMIN' WHERE email='you@yourdomain.in';`.

## API reference

Base URL is `/api`. Money is in **paise**. Success responses look like `{ "success": true, "data": …, "message"?, "meta"? }`. Errors look like `{ "success": false, "message": "…", "errorCode": "…", "details"? }`. State-changing browser requests must send the header `x-kc-client: web`.

**Auth & profile**
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{name,email,phone?,password}` → sets `kc_session` cookie |
| POST | `/auth/login` | `{email,password}` |
| POST | `/auth/logout` · `/auth/logout-all` | |
| GET | `/auth/session` | `{user|null}` (always 200) |
| POST | `/auth/forgot-password` · `/auth/reset-password` | `{email}` · `{token,password}` |
| GET/PATCH | `/me` | profile |
| POST | `/me/change-password` | revokes other sessions |

**Catalogue (public)**
| Method | Path | Notes |
|---|---|---|
| GET | `/products` | Query: `q, category, subcategory, brand, color, size, tags, ids, minPrice, maxPrice` (rupees), `rating, minDiscount, inStock, featured, bestSeller, newArrival, sort` (`relevance, price_asc, price_desc, newest, popular, rating, discount`), `page, limit` |
| GET | `/products/facets` | brands/colours/sizes/price range for the current scope |
| GET | `/products/:slug` · `/products/:slug/related` · `/products/:slug/reviews` | |
| GET | `/categories` · `/categories/:slug` | |
| GET | `/search/suggestions?q=` | |
| GET | `/home` · `/offers` · `/settings/public` · `/sitemap-data` · `/shipping/pincode/:pincode` | |
| POST | `/contact` | |

**Customer**
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/addresses` | |
| PATCH/DELETE | `/addresses/:id` | |
| POST | `/addresses/:id/default` | |
| GET | `/cart` | `?pincode&state&paymentMethod` for exact shipping/GST/COD |
| DELETE | `/cart` | |
| POST | `/cart/items` | `{variantId, quantity}` |
| PATCH/DELETE | `/cart/items/:id` | |
| POST | `/cart/quote` | guest pricing `{items, couponCode?}` |
| POST | `/cart/merge` | |
| POST/DELETE | `/cart/coupon` | |
| POST | `/coupons/validate` | `{code, items?}` |
| GET/POST | `/wishlist` | |
| GET | `/wishlist/ids` | |
| DELETE | `/wishlist/:productId` | |
| POST | `/wishlist/:productId/move-to-cart` | |
| POST | `/orders` | `{addressId, paymentMethod, couponCode?, customerNote?, idempotencyKey, expectedTotal?}` |
| GET | `/orders` · `/orders/:orderNumber` · `/orders/:orderNumber/invoice` | |
| POST | `/orders/:orderNumber/cancel` · `/orders/:orderNumber/return` | |
| POST | `/reviews` · `/uploads/review-image` | |
| GET | `/reviews/mine` · `/notifications` | |
| POST | `/notifications/read` | |

**Payments**
| Method | Path | Notes |
|---|---|---|
| GET | `/payments/config` | which gateways are enabled + public keys |
| POST | `/payments/razorpay/create` | `{orderNumber}` → Razorpay order |
| POST | `/payments/razorpay/verify` | `{orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature}` |
| POST | `/payments/razorpay/failed` | |
| POST | `/payments/razorpay/webhook` | `X-Razorpay-Signature` |
| POST | `/payments/stripe/create` · `/payments/stripe/confirm` | |
| POST | `/payments/stripe/webhook` | `Stripe-Signature` |

**Admin** (`/admin/*`, ADMIN only)
`GET /dashboard` · products `GET|POST /products`, `GET|PATCH|DELETE /products/:id`, `PATCH /products/:id/status` · `POST /uploads` (multipart `images[]`) · categories `GET|POST /categories`, `PATCH|DELETE /categories/:id`, `POST /subcategories`, `PATCH|DELETE /subcategories/:id` · orders `GET /orders` (`q,status,paymentStatus,paymentMethod,from,to`), `GET /orders/:orderNumber`, `PATCH /orders/:orderNumber/status` · `GET /returns`, `PATCH /returns/:id` (`APPROVE|REJECT|RECEIVE`) · `GET /refunds`, `POST /refunds/:id/process` · customers `GET /customers`, `GET /customers/:id`, `PATCH /customers/:id/status` · inventory `GET /inventory` (`q, lowStock`), `POST /inventory/adjust`, `GET /inventory/:variantId/history` · coupons `GET|POST /coupons`, `PATCH|DELETE /coupons/:id` · reviews `GET /reviews`, `PATCH|DELETE /reviews/:id` · settings `GET|PATCH /settings`, `GET|PUT /pincodes`, `DELETE /pincodes/:pincode` · `GET /messages`, `PATCH /messages/:id` · `GET /notifications`, `POST /notifications/read`

Common error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CSRF_CHECK_FAILED`, `NOT_FOUND`/`PRODUCT_NOT_FOUND`/`ORDER_NOT_FOUND`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `PRODUCT_UNAVAILABLE`, `PRICE_CHANGED`, `COUPON_*`, `COD_UNAVAILABLE`, `PINCODE_NOT_SERVICEABLE`, `PAYMENT_VERIFICATION_FAILED`, `PAYMENT_WINDOW_EXPIRED`, `INVALID_WEBHOOK_SIGNATURE`, `INVALID_STATUS_TRANSITION`, `RATE_LIMITED`.

## Production build & deployment

```bash
# Backend
cd backend && npm ci && npx prisma generate && npm run build
npx prisma migrate deploy
NODE_ENV=production node dist/server.js          # or: pm2 start dist/server.js --name kashif-api

# Frontend
cd frontend && npm ci && npm run build
NODE_ENV=production npm start                     # or: pm2 start npm --name kashif-web -- start
```

Recommended topology: `www.kashifcollection.in` serves the Next.js app and `api.kashifcollection.in` serves the Express API. The browser only uses `https://www/api/*`, which the Next.js proxy forwards to the API.

1. **Database:** use a managed PostgreSQL (Neon, Supabase, AWS RDS, DigitalOcean) with automated backups. Set `DATABASE_URL` with `sslmode=require` where needed.
2. **API:** deploy to Render, Railway, Fly.io or a VPS with Node 20 + PM2 behind nginx.
   - Set `NODE_ENV=production`, a strong `JWT_SECRET`, `FRONTEND_URL=https://www.kashifcollection.in`, `API_PUBLIC_URL`, `PROXY_SHARED_SECRET`, Cloudinary, SMTP and the gateway keys (test first, then live).
   - Set `TRUST_PROXY` to the number of proxies in front of the API.
   - Run `prisma migrate deploy` on each release.
3. **Frontend:** deploy to Vercel or a Node host. Set `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL=https://api.kashifcollection.in` and `PROXY_SHARED_SECRET` (the same value as the API). Behind nginx, add `proxy_set_header X-Real-IP $remote_addr;` so the proxy sees the real visitor IP.
4. **Webhooks** must point to the **API domain** directly: `https://api…/api/payments/razorpay/webhook` and `https://api…/api/payments/stripe/webhook`.
5. **Background job:** the API runs the unpaid-order expiry every minute (`ENABLE_JOBS=true`). With several API instances this is safe because each expiry is row-locked. On serverless or cron platforms, set `ENABLE_JOBS=false` and schedule `npm run jobs:expire-orders` every 5 minutes.
6. **Go live:**
   - Switch the Razorpay and Stripe keys to live.
   - Configure `BUSINESS_GSTIN`, and set the phone, email and address in `backend/src/config/business.ts` and `frontend/lib/site.ts`.
   - Replace placeholder images and brand copy.
   - Review the policy pages with a legal advisor.
   - Create the admin account as described in [Admin login](#admin-login).

## Security

- Passwords are hashed with bcrypt (12 rounds), and login timing is uniform even for unknown emails.
- Sessions are JWT (HS256) in an **HTTP-only, SameSite=Lax, Secure (prod)** cookie. Each token carries a `tokenVersion`, so changing or resetting the password, or deactivating an account, revokes every session.
- Every non-GET request must carry the `x-kc-client` header. Cross-site forms cannot set it, and CORS only allows the storefront origin. Signed webhooks are exempt.
- RBAC: `requireRole('ADMIN')` protects all admin APIs, and the admin UI checks the role on the server.
- Every body, query and param is validated with zod. Unknown fields are stripped.
- Prices, discounts, tax, shipping, coupons and stock are all recomputed server-side. Stock can never go negative (DB CHECK constraints plus conditional updates).
- Payments:
  - Razorpay uses HMAC SHA-256 signatures with constant-time comparison.
  - The Stripe PaymentIntent is re-fetched from Stripe before an order is marked paid.
  - Webhook signatures are verified on the raw body, and processed event ids are deduplicated.
- Other protections:
  - helmet headers (API CSP `default-src 'none'`); secure headers on the frontend.
  - Rate limits: global, auth (20 per 15 minutes) and sensitive routes (10 per hour), keyed on the real visitor IP.
  - Uploads are limited to 5 MB and the image type is checked by magic bytes.
  - Admin views never return password hashes or token versions.
- Errors use a consistent envelope, and there are **no stack traces in production**. The config validator refuses to start in production with a development JWT secret.
- JSON-LD output is escaped, and the `next` redirect after login only accepts relative paths.

## Performance & SEO

- **Queries:** every list is paginated and filtered in the database (indexes on all filter/sort columns, GIN on tags). Aggregates run in SQL (dashboard, facets).
- **Caching:** catalogue responses send `Cache-Control` (short max-age plus stale-while-revalidate), and server components use Next.js revalidation (30s–10 min).
- **Images:** `next/image` serves AVIF/WebP, responsive `sizes` and lazy loading. Cloudinary delivers `f_auto,q_auto` images capped at 1600px.
- **Frontend:** routes are code-split, with skeleton loaders and `loading.tsx` states. Mobile-first layouts include a sticky add-to-bag / checkout bar and a bottom navigation.
- **SEO:**
  - Dynamic titles and descriptions, canonical URLs and Open Graph tags.
  - `sitemap.xml` built from live products and categories; `robots.txt` excludes private pages.
  - JSON-LD for Store, Product (AggregateOffer + AggregateRating), BreadcrumbList and FAQPage.
  - SEO-friendly URLs like `/products/cosmetics/velvet-matte-lipstick`. A wrong category segment 308-redirects to the canonical URL.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration: JWT_SECRET…` | Set a ≥ 32 character `JWT_SECRET` in `backend/.env` |
| `P1001 Can't reach database server` | Start PostgreSQL / `docker compose up -d`; check `DATABASE_URL` |
| `P3014 … shadow database` during `migrate dev` | Create `kashif_shadow` and set `SHADOW_DATABASE_URL`, or give the DB user `CREATEDB` |
| `permission denied to create extension "pg_trgm"` | Needed by a historical migration. Run `CREATE EXTENSION pg_trgm;` as a superuser once (available on all major managed providers) |
| Storefront shows "catalogue is taking a moment" | The API is down or `API_INTERNAL_URL` is wrong. Check `curl $API_INTERNAL_URL/api/health` |
| `403 CSRF_CHECK_FAILED` from scripts | Send `x-kc-client: <anything>` or use `Authorization: Bearer <token>` |
| Login works but you are logged out immediately | Cookie blocked. Serve both apps over HTTPS in production, and do not set `COOKIE_DOMAIN` unless you call the API cross-subdomain |
| Razorpay/Stripe shown as "Currently unavailable" | Keys are missing in `backend/.env`. Restart the API after setting them |
| Paid but the order is still "Awaiting payment" | The webhook is not reaching the API (check the URL/secret in the gateway dashboard). The expiry job reconciles automatically within the reservation window |
| Password-reset email never arrives | Configure `SMTP_*`. In development the link is printed in the API log |
| Image upload fails in production | Set `CLOUDINARY_*` (local disk uploads are disabled in production) |
| `429 RATE_LIMITED` for everyone | `PROXY_SHARED_SECRET` differs between frontend and backend, or `TRUST_PROXY` is wrong |
| Tests fail with `database … does not exist` | Create `kashif_collection_test` (see Installation) |

## Known limitations

- **Placeholder content.** Product imagery is generated SVG art, and the brand copy, phone number, email, social links and policy texts are placeholders to be replaced before launch.
- **Payment gateways were verified against test doubles.** They have not been exercised against the live Razorpay or Stripe sandboxes in this environment. The integration code follows the official SDK APIs; run one sandbox payment per gateway before going live.
- **Checkout requires an account.** Guests can build a bag and see server prices, but must log in to place an order.
- **Single-currency, domestic-only shipping.** INR only; addresses are limited to India.
- **The shipping provider is manual.** The admin enters the AWB when marking an order shipped. Courier APIs plug in through the provider interface.
- **Returns cover whole orders**, not individual items or partial quantities.
- **Stock adjustments happen on the Inventory page**, not in the product form (by design, for the audit trail).
- **Advisories in build tooling.** `npm audit` reports advisories in Next.js's bundled PostCSS (it only processes the app's own CSS; the fix requires Next 16) and in Prisma's CLI config merger (dev/build tooling). Upgrade when moving to Next 16 / Prisma 7.
- **Notifications are in-app plus optional email.** There is no SMS or WhatsApp yet.

## Recommended next improvements

1. SMS/WhatsApp order updates (e.g. MSG91 or the Gupshup WhatsApp Business API) and OTP login.
2. A courier integration (Shiprocket/Delhivery) through the `ShippingProvider` interface, with automatic AWB creation and tracking webhooks.
3. Guest checkout with order lookup by phone and OTP.
4. Item-level partial returns and exchanges.
5. Full-text search with PostgreSQL `tsvector` or Meilisearch for typo tolerance at larger catalogue sizes.
6. Redis for the rate-limit store (multi-instance), catalogue caching and a job queue (BullMQ) for emails and expiry.
7. An admin role/permission matrix (e.g. staff who can fulfil orders but cannot change prices) and an admin activity log.
8. Product bundles, "complete the look" recommendations and back-in-stock alerts.
9. Observability: Sentry, structured log shipping and uptime checks on `/api/health`.
10. CI (GitHub Actions) running typecheck, lint, backend tests and the browser smoke test on every push.
