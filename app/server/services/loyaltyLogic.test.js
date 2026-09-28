import { describe, it, expect } from 'vitest';
import { computeLoyaltyScore } from './loyaltyLogic.js';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('computeLoyaltyScore', () => {
  it('scores a customer with zero orders as tier "new" with a score of 0', () => {
    const result = computeLoyaltyScore({ orderCount: 0, totalSpent: '0.00', lastOrderAt: null });

    expect(result.score).toBe(0);
    expect(result.tier).toBe('new');
  });

  it('scores a frequent, high-spending, recent shopper as "vip"', () => {
    const result = computeLoyaltyScore({
      orderCount: 15,
      totalSpent: '2000.00',
      lastOrderAt: daysAgo(1),
    });

    // 15*8 + 2000/20 - 1*0.5 = 120 + 100 - 0.5 = 219.5, clamped to 100.
    expect(result.score).toBe(100);
    expect(result.tier).toBe('vip');
  });

  it('flags a customer who has not ordered in over 60 days as "at_risk", even with a high score', () => {
    const result = computeLoyaltyScore({
      orderCount: 20,
      totalSpent: '5000.00',
      lastOrderAt: daysAgo(90),
    });

    // The raw score would clear the VIP threshold, but recency overrides it.
    expect(result.tier).toBe('at_risk');
  });

  it('scores a light, infrequent shopper as "regular" rather than "vip"', () => {
    const result = computeLoyaltyScore({
      orderCount: 1,
      totalSpent: '30.00',
      lastOrderAt: daysAgo(5),
    });

    expect(result.tier).toBe('regular');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(80);
  });

  it('never returns a negative score, even for a very stale single order', () => {
    const result = computeLoyaltyScore({
      orderCount: 1,
      totalSpent: '5.00',
      lastOrderAt: daysAgo(500),
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.tier).toBe('at_risk');
  });

  it('treats a customer with orders but no lastOrderAt on record as maximally stale', () => {
    const result = computeLoyaltyScore({ orderCount: 3, totalSpent: '100.00', lastOrderAt: null });

    expect(result.score).toBe(0);
    expect(result.tier).toBe('at_risk');
  });
});
