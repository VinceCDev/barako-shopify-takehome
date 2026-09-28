import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import { refreshInventoryAlerts } from '../services/inventoryLogic.js';
import { logActivity } from '../db/shopRepository.js';

export const inventoryRouter = express.Router();

// Dashboard read: every product plus its live-computed reorder status.
inventoryRouter.get('/api/inventory', async (req, res) => {
  const results = await refreshInventoryAlerts(req.shop.id);
  res.json(results.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout || 0));
});

// Create/update workflow: the merchant tunes reorderThreshold/leadTimeDays
// per product, and the recommendation recomputes against the new values.
inventoryRouter.patch('/api/inventory/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const { reorderThreshold, leadTimeDays } = req.body;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product || product.shopId !== req.shop.id) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const updates = {};
  if (reorderThreshold !== undefined) updates.reorderThreshold = reorderThreshold;
  if (leadTimeDays !== undefined) updates.leadTimeDays = leadTimeDays;

  await db.update(products).set(updates).where(eq(products.id, productId));
  await logActivity({
    shopId: req.shop.id,
    module: 'inventory',
    entityType: 'product',
    entityId: productId,
    action: 'settings_updated',
    message: `Reorder settings updated for ${product.title}.`,
  });

  const [updated] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  res.json(updated);
});

// Logs that a reorder was actually placed, for the Activity/history feed —
// this app doesn't place real purchase orders with a supplier, just tracks
// that the merchant took action on the recommendation.
inventoryRouter.post('/api/inventory/:productId/reorder', async (req, res) => {
  const productId = Number(req.params.productId);
  const { quantity } = req.body;

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product || product.shopId !== req.shop.id) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  await logActivity({
    shopId: req.shop.id,
    module: 'inventory',
    entityType: 'product',
    entityId: productId,
    action: 'reorder_placed',
    message: `Reorder of ${quantity} units placed for ${product.title}.`,
  });

  res.json({ ok: true });
});
