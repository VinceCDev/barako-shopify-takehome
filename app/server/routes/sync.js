import express from 'express';
import { syncProducts, syncCustomers, syncOrders } from '../services/shopifySync.js';
import { refreshInventoryAlerts } from '../services/inventoryLogic.js';
import { refreshLoyaltyScores } from '../services/loyaltyLogic.js';
import { refreshFulfillmentQueue } from '../services/fulfillmentLogic.js';

export const syncRouter = express.Router();

/*
 * DOCU: Pulls fresh data from Shopify (products, customers, then orders —
 * in that order, since orders link to both) and recomputes all three
 * modules' scores against it. This is the one endpoint the dashboard's
 * "Refresh" button calls; a real production app would also run this on
 * a schedule and via webhooks, noted as a next step in APP_DECISIONS.md.
 */
syncRouter.post('/api/sync', async (req, res) => {
  try {
    const shop = req.shop;
    const [productCount, customerCount] = await Promise.all([syncProducts(shop), syncCustomers(shop)]);
    const orderCount = await syncOrders(shop);

    const [inventory, loyalty, fulfillment] = await Promise.all([
      refreshInventoryAlerts(shop.id),
      refreshLoyaltyScores(shop.id),
      refreshFulfillmentQueue(shop.id),
    ]);

    res.json({
      synced: { products: productCount, customers: customerCount, orders: orderCount },
      recomputed: { inventory: inventory.length, loyalty: loyalty.length, fulfillment: fulfillment.length },
    });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed. See server logs for details.' });
  }
});
