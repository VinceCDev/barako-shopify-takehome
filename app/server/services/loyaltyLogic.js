import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers } from '../db/schema.js';
import { logActivity } from '../db/shopRepository.js';

const VIP_SCORE_THRESHOLD = 80;
const AT_RISK_DAYS_SINCE_ORDER = 60;

/*
 * DOCU: Computes an RFM-style (Recency, Frequency, Monetary) loyalty
 * score for one customer, and the tier that score falls into.
 *
 * The formula rewards frequent, high-spending, recent shoppers:
 *   score = (orderCount * 8) + (totalSpent / 20) - (daysSinceLastOrder * 0.5)
 * clamped to [0, 100]. A customer who hasn't ordered in over
 * AT_RISK_DAYS_SINCE_ORDER days is flagged "at_risk" regardless of score
 * — a lapsing VIP is exactly who a merchant most wants surfaced, not
 * buried under their historically-high score.
 *
 * @param {Object} customer - A row from the customers table (orderCount, totalSpent, lastOrderAt).
 * @returns {{score: number, tier: 'new'|'regular'|'vip'|'at_risk'}}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export function computeLoyaltyScore(customer) {
  if (customer.orderCount === 0) {
    return { score: 0, tier: 'new' };
  }

  const daysSinceLastOrder = customer.lastOrderAt
    ? (Date.now() - new Date(customer.lastOrderAt).getTime()) / (24 * 60 * 60 * 1000)
    : Infinity;

  const rawScore =
    customer.orderCount * 8 + Number(customer.totalSpent) / 20 - daysSinceLastOrder * 0.5;
  const score = Math.max(0, Math.min(100, rawScore));

  let tier = 'regular';
  if (daysSinceLastOrder > AT_RISK_DAYS_SINCE_ORDER) {
    tier = 'at_risk';
  } else if (score >= VIP_SCORE_THRESHOLD) {
    tier = 'vip';
  }

  return { score: Number(score.toFixed(2)), tier };
}

/*
 * DOCU: Recomputes loyalty score/tier for every customer in a shop, and
 * logs an activity entry whenever a customer's tier actually changes
 * (not on every recompute — that would flood the log with no-op noise).
 * @param {number} shopId - The shop to recompute customer scores for.
 * @returns {Promise<Array>} - Every customer row, updated with its new score/tier.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function refreshLoyaltyScores(shopId) {
  const shopCustomers = await db.select().from(customers).where(eq(customers.shopId, shopId));

  const results = [];
  for (const customer of shopCustomers) {
    const { score, tier } = computeLoyaltyScore(customer);

    if (tier !== customer.loyaltyTier) {
      await logActivity({
        shopId,
        module: 'loyalty',
        entityType: 'customer',
        entityId: customer.id,
        action: 'tier_changed',
        message: `${customer.firstName || 'Customer'} ${customer.lastName || ''} moved from ${customer.loyaltyTier} to ${tier} (score ${score}).`.trim(),
      });
    }

    await db.update(customers).set({ loyaltyScore: score.toFixed(2), loyaltyTier: tier }).where(eq(customers.id, customer.id));
    results.push({ ...customer, loyaltyScore: score, loyaltyTier: tier });
  }

  return results;
}
