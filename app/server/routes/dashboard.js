import express from 'express';
import { eq, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orders as ordersTable, activityLogs } from '../db/schema.js';
import { refreshInventoryAlerts } from '../services/inventoryLogic.js';
import { refreshLoyaltyScores } from '../services/loyaltyLogic.js';
import { refreshFulfillmentQueue } from '../services/fulfillmentLogic.js';

export const dashboardRouter = express.Router();

/*
 * DOCU: Aggregate counts for the Dashboard overview page's summary
 * cards and charts — how many products need attention, how many
 * customers are in each loyalty tier, how open/fulfilled orders break
 * down, and the top 5 fastest-moving products by sales velocity —
 * without the frontend having to fetch all three full lists just to
 * show a handful of numbers.
 */
dashboardRouter.get('/api/dashboard/summary', async (req, res) => {
  const [inventory, loyalty, fulfillment, allOrders, [activityRow]] = await Promise.all([
    refreshInventoryAlerts(req.shop.id),
    refreshLoyaltyScores(req.shop.id),
    refreshFulfillmentQueue(req.shop.id),
    db.select().from(ordersTable).where(eq(ordersTable.shopId, req.shop.id)),
    db.select({ value: count() }).from(activityLogs).where(eq(activityLogs.shopId, req.shop.id)),
  ]);

  // refreshFulfillmentQueue only returns open (not-yet-fulfilled) orders —
  // the fulfilled count for the chart comes from the raw orders table.
  const fulfilledCount = allOrders.filter((o) => o.fulfillmentStatus === 'fulfilled').length;

  const topProducts = [...inventory]
    .filter((p) => p.salesVelocity > 0)
    .sort((a, b) => b.salesVelocity - a.salesVelocity)
    .slice(0, 5)
    .map((p) => ({ title: p.title, salesVelocity: Number(p.salesVelocity.toFixed(2)) }));

  res.json({
    inventory: {
      critical: inventory.filter((p) => p.alertLevel === 'critical').length,
      low: inventory.filter((p) => p.alertLevel === 'low').length,
      ok: inventory.filter((p) => p.alertLevel === 'ok').length,
      total: inventory.length,
    },
    loyalty: {
      vip: loyalty.filter((c) => c.loyaltyTier === 'vip').length,
      regular: loyalty.filter((c) => c.loyaltyTier === 'regular').length,
      new: loyalty.filter((c) => c.loyaltyTier === 'new').length,
      atRisk: loyalty.filter((c) => c.loyaltyTier === 'at_risk').length,
      total: loyalty.length,
    },
    fulfillment: {
      unfulfilled: fulfillment.filter((o) => o.fulfillmentStatus === 'unfulfilled').length,
      inProgress: fulfillment.filter((o) => o.fulfillmentStatus === 'in_progress').length,
      fulfilled: fulfilledCount,
      total: fulfillment.length,
    },
    activity: {
      total: activityRow?.value || 0,
    },
    topProducts,
  });
});
