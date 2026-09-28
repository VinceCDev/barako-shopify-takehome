import express from 'express';
import { refreshFulfillmentQueue, markFulfillmentStatus } from '../services/fulfillmentLogic.js';

export const ordersRouter = express.Router();

// Dashboard read: open orders, ranked by fulfillment priority score.
ordersRouter.get('/api/orders', async (req, res) => {
  const results = await refreshFulfillmentQueue(req.shop.id);
  res.json(results);
});

// Create/update workflow: move an order through unfulfilled -> in_progress
// -> fulfilled.
ordersRouter.patch('/api/orders/:orderId/status', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status } = req.body;

  if (!['unfulfilled', 'in_progress', 'fulfilled'].includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }

  try {
    await markFulfillmentStatus(req.shop.id, orderId, status);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
