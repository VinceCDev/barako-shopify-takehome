import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers } from '../db/schema.js';
import { refreshLoyaltyScores } from '../services/loyaltyLogic.js';

export const customersRouter = express.Router();

// Dashboard read: every customer, ranked by loyalty score.
customersRouter.get('/api/customers', async (req, res) => {
  const results = await refreshLoyaltyScores(req.shop.id);
  res.json(results.sort((a, b) => b.loyaltyScore - a.loyaltyScore));
});

// The "update" half of this module's workflow is really just letting a
// merchant force a re-score for one customer after e.g. contacting an
// at-risk VIP — full CRUD on a synced customer record isn't the point.
customersRouter.post('/api/customers/:customerId/recompute', async (req, res) => {
  const customerId = Number(req.params.customerId);
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer || customer.shopId !== req.shop.id) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  const allRescored = await refreshLoyaltyScores(req.shop.id);
  const updated = allRescored.find((row) => row.id === customerId);
  res.json(updated);
});
