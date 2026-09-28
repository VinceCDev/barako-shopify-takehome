import { eq, and, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products, orderLineItems, orders } from '../db/schema.js';
import { logActivity } from '../db/shopRepository.js';

const VELOCITY_WINDOW_DAYS = 30;
const MIN_RECOMMENDED_QTY = 1;

/*
 * DOCU: Computes the reorder status for one product: how fast it's
 * selling, how many days of stock remain at that rate, an alert level,
 * and a recommended reorder quantity.
 *
 * The recommendation covers `leadTimeDays` of expected demand at the
 * recent sales velocity, minus what's already on hand — e.g. selling 2
 * units/day with a 14-day lead time and 5 in stock recommends
 * ceil(2 * 14) - 5 = 23 units, so stock doesn't run out before the next
 * order arrives.
 *
 * @param {Object} product - A row from the products table.
 * @param {number} unitsSoldRecently - Units of this product sold in the last VELOCITY_WINDOW_DAYS days.
 * @returns {{salesVelocity: number, daysUntilStockout: number|null, alertLevel: 'ok'|'low'|'critical', recommendedReorderQty: number}}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export function computeReorderStatus(product, unitsSoldRecently) {
  const salesVelocity = unitsSoldRecently / VELOCITY_WINDOW_DAYS;

  // No recent sales at all — can't estimate a stockout date, and there's
  // nothing to recommend reordering against yet.
  if (salesVelocity === 0) {
    return {
      salesVelocity: 0,
      daysUntilStockout: null,
      alertLevel: 'ok',
      recommendedReorderQty: 0,
    };
  }

  const daysUntilStockout = product.currentStock / salesVelocity;

  let alertLevel = 'ok';
  if (daysUntilStockout < 7) {
    alertLevel = 'critical';
  } else if (daysUntilStockout < product.leadTimeDays) {
    alertLevel = 'low';
  }

  const demandDuringLeadTime = salesVelocity * product.leadTimeDays;
  const recommendedReorderQty =
    alertLevel === 'ok' ? 0 : Math.max(MIN_RECOMMENDED_QTY, Math.ceil(demandDuringLeadTime - product.currentStock));

  return { salesVelocity, daysUntilStockout, alertLevel, recommendedReorderQty };
}

/*
 * DOCU: Recomputes reorder status for every product in a shop, from its
 * recent order-line-item history, and logs an activity entry for any
 * product that has just crossed into "low" or "critical".
 * @param {number} shopId - The shop to recompute inventory alerts for.
 * @returns {Promise<Array>} - Every product row, each annotated with its computed reorder status.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function refreshInventoryAlerts(shopId) {
  const shopProducts = await db.select().from(products).where(eq(products.shopId, shopId));
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const results = [];
  for (const product of shopProducts) {
    const soldRows = await db
      .select({ quantity: orderLineItems.quantity })
      .from(orderLineItems)
      .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
      .where(and(eq(orderLineItems.productId, product.id), gte(orders.shopifyCreatedAt, windowStart)));

    const unitsSoldRecently = soldRows.reduce((sum, row) => sum + row.quantity, 0);
    const status = computeReorderStatus(product, unitsSoldRecently);

    if (status.alertLevel !== 'ok') {
      await logActivity({
        shopId,
        module: 'inventory',
        entityType: 'product',
        entityId: product.id,
        action: 'reorder_alert',
        message: `${product.title} is ${status.alertLevel} on stock (${product.currentStock} left, ~${status.daysUntilStockout.toFixed(1)} days). Recommended reorder: ${status.recommendedReorderQty} units.`,
      });
    }

    results.push({ ...product, ...status });
  }

  return results;
}
