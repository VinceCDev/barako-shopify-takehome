# Barako Merchant Tools

An embedded Shopify Admin app for **Barako & Co.** (the coffee brand from Part 1's theme). It solves three related merchant-workflow problems in one dashboard:

1. **Inventory Alerts** — sales-velocity-based low-stock alerts and reorder quantity recommendations.
2. **Customer Loyalty** — RFM-style scoring that tiers customers as New / Regular / VIP / At risk.
3. **Fulfillment Queue** — a priority-ranked view of open orders (age + value + customer tier), instead of a plain chronological list.

All three share one unified Activity/history log.

## Tech stack

- **Frontend:** Vite + React + Shopify Polaris + App Bridge
- **Backend:** Node.js + Express
- **Database:** MySQL, accessed via Drizzle ORM
- **Auth:** Shopify OAuth (offline access token), implemented directly with `@shopify/shopify-api` — not hidden behind a framework, so the handshake in `server/auth.js` is fully readable

## Project structure

```
app/
├── server/            Node.js + Express backend
│   ├── db/            Drizzle schema, client, migrations, shop repository
│   ├── routes/        Express routers, one per resource
│   ├── services/      The actual business logic (scoring/ranking) + Shopify sync
│   ├── auth.js         OAuth begin/callback
│   ├── verifyRequest.js Session-token verification middleware
│   ├── shopify.js      Shopify API client config
│   └── index.js        Server entry point
└── client/            Vite + React frontend
    └── src/
        ├── pages/       Dashboard, Inventory, Customers, Orders, ActivityLog
        └── api/client.js  Authenticated fetch helper (App Bridge session tokens)
```

## Prerequisites

- Node.js 18+
- A MySQL server (local install, Docker, or a hosted instance)
- A Shopify Partner account with an app created in the **Dev Dashboard**, and a development store to install it on

## Setup

### 1. Install dependencies

```sh
cd app
npm run install:all
```

### 2. Create the database

```sql
CREATE DATABASE barako_merchant_tools;
```

### 3. Configure environment variables

Copy `server/.env.example` to `server/.env` and fill in your values:

```
SHOPIFY_API_KEY=<your app's Client ID>
SHOPIFY_API_SECRET=<your app's Client secret>
SHOPIFY_APP_URL=<your app's public URL — see step 5>
SCOPES=read_products,write_products,read_orders,read_customers
DATABASE_URL=mysql://<user>:<password>@localhost:3306/barako_merchant_tools
PORT=3000
```

Also set `client/.env`:

```
VITE_SHOPIFY_API_KEY=<the same Client ID as above>
```

### 4. Run the database migrations

```sh
npm run db:generate   # generates SQL from server/db/schema.js
npm run db:migrate    # applies it to your database
```

### 5. Expose your local server publicly

Shopify's OAuth callback and the embedded app iframe both require a public HTTPS URL, even in development. Use a tunnel:

```sh
ngrok http 3000
```

Copy the `https://....ngrok-free.app` URL ngrok gives you into:

- `SHOPIFY_APP_URL` in `server/.env`
- Your app's **App URL** and **Allowed redirection URL(s)** (`<tunnel-url>/api/auth/callback`) in the Shopify Dev Dashboard

### 6. Run the app

In two terminals:

```sh
npm run dev:server   # http://localhost:3000
npm run dev:client   # http://localhost:5173, proxies /api to the server
```

For production (or to test the embedded flow through the tunnel as Shopify sees it), build the client and let Express serve it:

```sh
npm run build:client
npm run dev:server
```

### 7. Install the app on your dev store

Visit:

```
<your-tunnel-url>/api/auth?shop=<your-dev-store>.myshopify.com
```

Approve the requested scopes — you'll land in the embedded app inside Shopify Admin. Click **Refresh from Shopify** on the Dashboard to pull in your store's products, customers, and orders for the first time.

## Database schema

Six related tables (see `server/db/schema.js` for the full Drizzle definitions and indexes):

| Table              | Purpose                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `shops`            | One row per install; holds the offline OAuth access token               |
| `products`         | Synced from Shopify + our own reorder threshold/lead-time settings      |
| `customers`        | Synced from Shopify + our own computed loyalty score/tier               |
| `orders`           | Synced from Shopify + our own computed fulfillment priority score       |
| `order_line_items` | One row per line item per order — what makes real per-product sales velocity possible |
| `activity_logs`    | The shared history feed across all three modules                        |

## The logic-based features

See the DOCU comments in `server/services/inventoryLogic.js`, `loyaltyLogic.js`, and `fulfillmentLogic.js` for the exact formulas. Summary:

- **Reorder scoring:** `salesVelocity = unitsSoldLast30Days / 30`, `daysUntilStockout = currentStock / salesVelocity`, alert level thresholds on that, recommended quantity covers `leadTimeDays` of demand.
- **Loyalty scoring:** an RFM-style weighted score from order count, total spent, and recency, with an explicit "at risk" override for lapsed high-scorers.
- **Fulfillment priority:** weighted sum of order age, order value, and customer loyalty tier.

See `APP_DECISIONS.md` for the reasoning behind these choices, trade-offs, and what's next.
