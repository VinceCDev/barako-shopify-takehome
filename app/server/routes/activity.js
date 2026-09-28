import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { activityLogs } from '../db/schema.js';

export const activityRouter = express.Router();

// The unified History/Activity feed — every module's events, one page.
activityRouter.get('/api/activity', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const results = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.shopId, req.shop.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  res.json(results);
});
