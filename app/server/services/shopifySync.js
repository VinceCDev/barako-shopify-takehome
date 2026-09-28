import { eq, and } from 'drizzle-orm';
import { shopify } from '../shopify.js';
import { db } from '../db/client.js';
import { products, customers, orders, orderLineItems } from '../db/schema.js';

/*
 * DOCU: Builds an authenticated GraphQL client for one shop, from its
 * stored offline access token.
 * @param {Object} shop - A row from the shops table.
 * @returns {import('@shopify/shopify-api').GraphqlClient}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
function graphqlClientFor(shop) {
  const session = shopify.session.customAppSession(shop.shopDomain);
  session.accessToken = shop.accessToken;
  return new shopify.clients.Graphql({ session });
}

/*
 * DOCU: Pulls the shop's products (with their first variant's inventory
 * and SKU) from Shopify and upserts them into the local products table —
 * the data module 1's reorder logic runs against.
 * @param {Object} shop - A row from the shops table.
 * @returns {Promise<number>} - How many products were synced.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function syncProducts(shop) {
  const client = graphqlClientFor(shop);
  const response = await client.request(
    `#graphql
    query SyncProducts {
      products(first: 100) {
        edges {
          node {
            id
            title
            variants(first: 1) {
              edges {
                node {
                  id
                  sku
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }`
  );

  const edges = response.data?.products?.edges || [];
  for (const { node } of edges) {
    const variant = node.variants.edges[0]?.node;
    if (!variant) continue;

    const shopifyProductId = idFromGid(node.id);
    const shopifyVariantId = idFromGid(variant.id);

    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.shopId, shop.id), eq(products.shopifyVariantId, shopifyVariantId)))
      .limit(1);

    if (existing) {
      await db
        .update(products)
        .set({ title: node.title, sku: variant.sku, currentStock: variant.inventoryQuantity ?? 0 })
        .where(eq(products.id, existing.id));
    } else {
      await db.insert(products).values({
        shopId: shop.id,
        shopifyProductId,
        shopifyVariantId,
        title: node.title,
        sku: variant.sku,
        currentStock: variant.inventoryQuantity ?? 0,
      });
    }
  }

  return edges.length;
}

/*
 * DOCU: Pulls the shop's customers from Shopify and upserts them into the
 * local customers table — the data module 2's loyalty scoring runs
 * against. Order count/total spent come straight from Shopify's own
 * aggregates rather than being recomputed from synced orders, since
 * Shopify already tracks the customer's full history (including orders
 * placed before this app was installed).
 *
 * Deliberately does not request firstName/lastName/email: those are
 * Protected Customer Data fields that require an approved access grant,
 * which isn't available for this dev-store-only demo app. Customers are
 * shown by their Shopify id instead (see customers.firstName fallback in
 * client/src/pages/Customers.jsx).
 * @param {Object} shop - A row from the shops table.
 * @returns {Promise<number>} - How many customers were synced.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function syncCustomers(shop) {
  const client = graphqlClientFor(shop);
  const response = await client.request(
    `#graphql
    query SyncCustomers {
      customers(first: 100) {
        edges {
          node {
            id
            numberOfOrders
            amountSpent { amount }
            lastOrder { createdAt }
          }
        }
      }
    }`
  );

  const edges = response.data?.customers?.edges || [];
  for (const { node } of edges) {
    const shopifyCustomerId = idFromGid(node.id);
    const values = {
      firstName: `Customer`,
      lastName: `#${shopifyCustomerId}`,
      email: null,
      orderCount: Number(node.numberOfOrders) || 0,
      totalSpent: node.amountSpent?.amount || '0.00',
      lastOrderAt: node.lastOrder?.createdAt ? new Date(node.lastOrder.createdAt) : null,
    };

    const [existing] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.shopId, shop.id), eq(customers.shopifyCustomerId, shopifyCustomerId)))
      .limit(1);

    if (existing) {
      await db.update(customers).set(values).where(eq(customers.id, existing.id));
    } else {
      await db.insert(customers).values({ shopId: shop.id, shopifyCustomerId, ...values });
    }
  }

  return edges.length;
}

/*
 * DOCU: Pulls the shop's recent orders (and their line items) from
 * Shopify and upserts them into the local orders/order_line_items
 * tables — the data module 3's fulfillment queue runs against, and the
 * source data module 1's sales-velocity calculation reads from.
 * @param {Object} shop - A row from the shops table.
 * @returns {Promise<number>} - How many orders were synced.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function syncOrders(shop) {
  const client = graphqlClientFor(shop);
  const response = await client.request(
    `#graphql
    query SyncOrders {
      orders(first: 100, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
            customer { id }
            currentTotalPriceSet { shopMoney { amount } }
            lineItems(first: 20) {
              edges {
                node {
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  variant { id }
                }
              }
            }
          }
        }
      }
    }`
  );

  const edges = response.data?.orders?.edges || [];
  for (const { node } of edges) {
    const shopifyOrderId = idFromGid(node.id);

    let customerId = null;
    if (node.customer) {
      const [customerRow] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.shopId, shop.id), eq(customers.shopifyCustomerId, idFromGid(node.customer.id))))
        .limit(1);
      customerId = customerRow?.id ?? null;
    }

    const values = {
      customerId,
      orderNumber: node.name,
      totalPrice: node.currentTotalPriceSet.shopMoney.amount,
      fulfillmentStatus: mapFulfillmentStatus(node.displayFulfillmentStatus),
      shopifyCreatedAt: new Date(node.createdAt),
    };

    const [existing] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, shop.id), eq(orders.shopifyOrderId, shopifyOrderId)))
      .limit(1);

    let orderRowId;
    if (existing) {
      orderRowId = existing.id;
      await db.update(orders).set(values).where(eq(orders.id, existing.id));
    } else {
      await db.insert(orders).values({ shopId: shop.id, shopifyOrderId, ...values });
      const [inserted] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.shopId, shop.id), eq(orders.shopifyOrderId, shopifyOrderId)))
        .limit(1);
      orderRowId = inserted.id;
    }

    // Line items are only inserted once, on first sync of this order —
    // they don't change after the fact the way fulfillment status does.
    if (!existing) {
      for (const { node: lineItem } of node.lineItems.edges) {
        let productId = null;
        if (lineItem.variant) {
          const [productRow] = await db
            .select()
            .from(products)
            .where(and(eq(products.shopId, shop.id), eq(products.shopifyVariantId, idFromGid(lineItem.variant.id))))
            .limit(1);
          productId = productRow?.id ?? null;
        }

        await db.insert(orderLineItems).values({
          orderId: orderRowId,
          productId,
          quantity: lineItem.quantity,
          price: lineItem.originalUnitPriceSet.shopMoney.amount,
        });
      }
    }
  }

  return edges.length;
}

/*
 * DOCU: Extracts the numeric id from a Shopify GraphQL global id, e.g.
 * "gid://shopify/Product/123456789" -> 123456789.
 * @param {string} gid - A Shopify GraphQL global id.
 * @returns {number}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
function idFromGid(gid) {
  return Number(gid.split('/').pop());
}

/*
 * DOCU: Maps Shopify's displayFulfillmentStatus enum to our own simpler
 * three-state enum (we don't distinguish partial/scheduled/on_hold —
 * those all count as "in progress" for the priority queue's purposes).
 * @param {string} shopifyStatus - Shopify's own fulfillment status string.
 * @returns {'unfulfilled'|'in_progress'|'fulfilled'}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
function mapFulfillmentStatus(shopifyStatus) {
  if (shopifyStatus === 'FULFILLED') return 'fulfilled';
  if (shopifyStatus === 'UNFULFILLED') return 'unfulfilled';
  return 'in_progress';
}
