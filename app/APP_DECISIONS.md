# APP_DECISIONS.md

## Store concept

**Barako & Co.** — a Philippine single-origin coffee brand (Batangas, Benguet, Sagada, Mt. Apo, and Kalinga beans), plus a small line of brewing gear. The full storefront theme is in `../theme`. It's a small, single-location-feeling roastery, which shaped the app: this isn't a merchant with a 50-person ops team and existing BI tooling — it's someone who needs the three things this app does surfaced in one place, without hiring an analyst.

## App idea

**Barako Merchant Tools** — one embedded dashboard covering three related but distinct workflow problems a small coffee roaster actually has:

1. **Inventory Alerts.** Coffee is a perishable, batch-roasted product — running out of a popular origin isn't just a lost sale, it's a broken batch cadence. The app tracks sales velocity per product and tells the merchant not just "this is low" but *how many days until it's out* and *how much to reorder* given their supplier's lead time.
2. **Customer Loyalty.** A small brand's repeat customers matter disproportionately. The app scores every customer (recency, frequency, spend) so the merchant knows who to send a "thank you" discount to (VIP) and who's quietly slipping away (at risk) — before that customer emails support instead of just complains, they just leave.
3. **Fulfillment Queue.** With one small team packing orders, "what should I pack first" isn't obvious from a plain order list. The app ranks open orders by a blend of how long they've waited, how much they're worth, and who placed them.

These three share one **unified activity log** rather than three separate histories, because from the merchant's chair they're all just "things this app did for me today."

## Key architecture/schema decisions

### Theme (Part 1)

- **Section-based, not a single monolithic template.** Home, Collection, Product, and Cart are each composed from small, reusable sections/snippets (`hero-kapihan`, `origin-story`, `flavor-profile`, `brew-guide`, `featured-collection`, `product-reviews`, `breadcrumbs`, `search-bar`, `toast`, `confirm-dialog`, `payment-method-dialog`) rather than one large page template per route. This is the standard Shopify Online Store 2.0 pattern, and it's what let each round of feedback stay scoped to one file.
- **Demo-only, localStorage/sessionStorage-backed features (reviews, favorites, "demo login," simulated payment) instead of real Shopify subsystems**, because this store's **New Customer Accounts** setting can't be reverted to Classic (no toggle exists in this store's Admin), which hijacks `/account/login` and `/account/register` to Shopify's own hosted domain, and a real checkout wasn't reachable in this environment either. Simulating these client-side keeps the golden-path demo (browse → favorite → review → log in → cart → checkout) walkable end-to-end without a disruptive redirect out of the theme.
- **Global theme settings for "which collection is Coffee / which is Brewing Gear"** (`config/settings_schema.json`), instead of trusting `product.collections.first`, since Shopify's automated-collection ordering isn't guaranteed and breadcrumbs/search needed a reliable category label.

### App (Part 2)

- **OAuth implemented directly with `@shopify/shopify-api`, not a framework wrapper.** Packages like `@shopify/shopify-app-express` are reasonable in production, but for this exercise I wanted the handshake (`server/auth.js`) to be a few lines I can point at and explain, not a black box. Sessions are stored in our own `shops` table via Drizzle rather than a session-storage add-on package, for the same reason — it's directly auditable, and it's one less version-compatibility surface to get wrong under a deadline.
- **`order_line_items` as its own table**, rather than a JSON blob on `orders`. Sales velocity in module 1 needs *per-product* units sold, which is impossible to compute from an order total alone. This is the one table added specifically to make the logic-based feature honest rather than approximated.
- **One `activity_logs` table for all three modules**, distinguished by a `module` enum column, instead of three parallel log tables. A merchant thinks of this as "the app's activity," not "the inventory module's log" — and one schema is one thing to keep consistent as the app grows, not three.
- **Loyalty tier has an explicit "at risk" override**, not just a score threshold. A customer who was historically a big spender but hasn't ordered in 60+ days keeps a high *raw* score under a naive RFM formula — exactly the customer a merchant most needs flagged, not buried under "still looks great." The override exists because a scoring feature that quietly hides its own most useful signal isn't actually useful.
- **Fulfillment priority factors in loyalty tier**, linking module 3 to module 2's output. This was a deliberate choice to make the three modules feel like one system with real product thinking behind it, rather than three unrelated CRUD screens bolted together because the brief asked for three ideas.
- **Sync is a manual "Refresh" button, not (yet) webhooks or a cron job** — see Trade-offs below.

## Trade-offs

### Theme (Part 1)

- **Simulated login/checkout instead of the real thing.** The demo-login (sessionStorage) and payment-method dialog (client-side only, no real charge) exist only because the store's New Customer Accounts and checkout weren't usable in this environment. A production build of this theme would use Shopify's actual account/checkout flow — the simulated versions are clearly scoped to the demo and isolated in their own snippets (`toast.liquid`'s login state, `payment-method-dialog.liquid`) so they're easy to remove.
- **Reviews and favorites live in `localStorage`, per-browser, not per-customer.** Real reviews need a backend (a review app, or metafields written server-side) to be visible to other shoppers and survive across devices — what's here is a UI/UX proof of the feature, not a persisted one.

### App (Part 2)

- **Manual sync over real-time webhooks.** A production version of this app should register `orders/create`, `orders/updated`, and `products/update` webhooks so the dashboard reflects Shopify state within seconds, not "whenever the merchant clicks Refresh." I scoped this out under the deadline — polling/manual sync is simpler to get right and demo, but it's the single biggest thing I'd change first with more time.
- **Loyalty and fulfillment scoring formulas are reasonable, not tuned.** The weights (8 points per order, $1 per $20 spent, etc.) are defensible starting points I can explain, not the output of analyzing this merchant's actual sales data. A real version would make these merchant-configurable (like the reorder threshold/lead-time already is) or derive them from the store's own order-value distribution.
- **No pagination on the Shopify sync.** `syncProducts`/`syncCustomers`/`syncOrders` each pull up to 100 records per call. Fine for a small store like this one; a store with thousands of SKUs or customers needs cursor-based pagination through the GraphQL `pageInfo`.
- **Single-currency assumption.** `totalSpent`/`totalPrice` are stored as plain decimals with no currency column, which is fine for a single-market store like Barako & Co. but wouldn't hold up for a multi-currency merchant.
- **Tests cover the scoring logic, not the routes/OAuth.** `server/services/*.test.js` (vitest — `npm test` from `server/`) unit-tests the three pure scoring functions (`computeReorderStatus`, `computeLoyaltyScore`, `computePriorityScore`) against their documented edge cases (zero sales, score clamping, the at-risk override, tier weighting). Those functions were deliberately written pure (plain data in, plain data out, no DB/network calls) specifically so they'd be cheap to test. The Express routes, the OAuth callback, and the theme's client-side JS have no automated coverage — that's still manual/exploratory testing only, and is the next thing I'd add.

## What I'd improve with more time

### Theme (Part 1)

1. **Real accounts and checkout** once this store's New Customer Accounts setting can be reverted to Classic (or its hosted flow can be themed), removing the need for the demo-login/payment simulations entirely.
2. **Server-backed reviews**, e.g. via a metafield written through a small proxy endpoint (or this same app's backend), so a review posted by one shopper is visible to every other shopper, not just their own browser.
3. **Automated visual/interaction tests** (Playwright) for the cart's selective-checkout flow and the collection filters — the parts of the theme with the most custom JS logic and the most room for a regression to slip in silently.

### App (Part 2)

1. **Webhooks** for real-time sync (`orders/create`, `orders/updated`, `products/update`, `app/uninstalled` to soft-delete the shop row).
2. **A scheduled job** (or webhook-triggered recompute) so alert levels/scores update without a merchant needing to open the app.
3. **Merchant-configurable scoring weights** for loyalty and fulfillment priority, the same way reorder threshold/lead time already are per-product.
4. **Notifications** — an actual email/Slack alert when a product goes critical or a VIP customer lapses, instead of requiring the merchant to open the dashboard to notice.
5. **Route/integration tests** (supertest against a test database) for the Express routes and the OAuth callback, to complement the existing unit tests on the scoring logic.
6. **Pagination** through Shopify's GraphQL `pageInfo` for stores larger than ~100 products/customers/orders.
