import { eq, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orders, customers } from '../db/schema.js';
import { logActivity } from '../db/shopRepository.js';

const TIER_WEIGHT = { vip: 30, regular: 10, at_risk: 20, new: 5 };

/*
 * DOCU: Computes a fulfillment priority score for one order, so the
 * queue surfaces "which order should I pack next" rather than a plain
 * chronological list.
 *
 * Three factors, each contributing points:
 *   - Age: older unfulfilled orders score higher (orders shouldn't sit
 *     forgotten just because a newer, flashier one came in) — 2 points
 *     per day waiting, capped at 40.
 *   - Order value: higher-value orders score higher (a merchant's own
 *     revenue is on the line if a big order is fulfilled late) — 1 point
 *     per $10, capped at 30.
 *   - Customer tier: a VIP or at-risk-but-still-ordering customer's
 *     order is worth prioritizing to protect that relationship — see
 *     TIER_WEIGHT above.
 *
 * @param {Object} order - A row from the orders table.
 * @param {'new'|'regular'|'vip'|'at_risk'} [customerTier] - The order's customer's loyalty tier, if known.
 * @returns {number} - The priority score (higher = fulfill sooner).
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export function computePriorityScore(order, customerTier) {
  const ageDays = (Date.now() - new Date(order.shopifyCreatedAt).getTime()) / (24 * 60 * 60 * 1000);
  const ageScore = Math.min(40, ageDays * 2);

  const valueScore = Math.min(30, Number(order.totalPrice) / 10);

  const tierScore = TIER_WEIGHT[customerTier] || 0;

  return Number((ageScore + valueScore + tierScore).toFixed(2));
}

/*
 * DOCU: Recomputes priority scores for every unfulfilled/in-progress
 * order in a shop. Doesn't log every recompute (priority scores drift
 * continuously just from order age) — only genuine fulfillment-status
 * changes are logged, via markFulfillmentStatus below.
 * @param {number} shopId - The shop to recompute order priorities for.
 * @returns {Promise<Array>} - The shop's open orders, sorted by priority score descending.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function refreshFulfillmentQueue(shopId) {
  const openOrders = await db
    .select({
      order: orders,
      customerTier: customers.loyaltyTier,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.shopId, shopId));

  const results = [];
  for (const { order, customerTier } of openOrders.filter((row) => row.order.fulfillmentStatus !== 'fulfilled')) {
    const priorityScore = computePriorityScore(order, customerTier);
    await db.update(orders).set({ priorityScore: priorityScore.toFixed(2) }).where(eq(orders.id, order.id));
    results.push({ ...order, priorityScore, customerTier });
  }

  return results.sort((a, b) => b.priorityScore - a.priorityScore);
}

/*
 * DOCU: Updates an order's fulfillment status (the create/update workflow
 * for module 3) and logs the change to the shared activity feed.
 * @param {number} shopId - The owning shop, for the activity log entry.
 * @param {number} orderId - The order to update.
 * @param {'unfulfilled'|'in_progress'|'fulfilled'} status - The new status.
 * @returns {Promise<void>}
 * @throws {Error} - If orderId doesn't belong to a real order.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function markFulfillmentStatus(shopId, orderId, status) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  await db
    .update(orders)
    .set({ fulfillmentStatus: status, fulfilledAt: status === 'fulfilled' ? new Date() : null })
    .where(eq(orders.id, orderId));

  await logActivity({
    shopId,
    module: 'fulfillment',
    entityType: 'order',
    entityId: orderId,
    action: 'status_changed',
    message: `Order ${order.orderNumber || order.id} marked as ${status.replace('_', ' ')}.`,
  });
}
