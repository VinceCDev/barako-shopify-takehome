import { describe, it, expect } from 'vitest';
import { computePriorityScore } from './fulfillmentLogic.js';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('computePriorityScore', () => {
  it('scores a brand-new, low-value order from a new customer near zero', () => {
    const score = computePriorityScore({ shopifyCreatedAt: daysAgo(0), totalPrice: '5.00' }, 'new');

    // ageScore ~0, valueScore 0.5, tierScore 5.
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThan(6);
  });

  it('gives older orders a higher score than otherwise-identical newer ones', () => {
    const older = computePriorityScore({ shopifyCreatedAt: daysAgo(10), totalPrice: '100.00' }, 'regular');
    const newer = computePriorityScore({ shopifyCreatedAt: daysAgo(1), totalPrice: '100.00' }, 'regular');

    expect(older).toBeGreaterThan(newer);
  });

  it('caps the age contribution at 40 points for very old orders', () => {
    const veryOld = computePriorityScore({ shopifyCreatedAt: daysAgo(365), totalPrice: '0' }, undefined);
    // ageScore capped at 40, valueScore 0, tierScore 0 (no tier).
    expect(veryOld).toBe(40);
  });

  it('caps the value contribution at 30 points for very expensive orders', () => {
    const expensive = computePriorityScore({ shopifyCreatedAt: daysAgo(0), totalPrice: '10000.00' }, undefined);
    expect(expensive).toBe(30);
  });

  it('weighs a VIP customer higher than a regular one, all else equal', () => {
    const vipOrder = computePriorityScore({ shopifyCreatedAt: daysAgo(2), totalPrice: '50.00' }, 'vip');
    const regularOrder = computePriorityScore({ shopifyCreatedAt: daysAgo(2), totalPrice: '50.00' }, 'regular');

    expect(vipOrder).toBeGreaterThan(regularOrder);
  });

  it('treats an unknown/missing customer tier as contributing zero tier points', () => {
    const withUnknownTier = computePriorityScore({ shopifyCreatedAt: daysAgo(2), totalPrice: '50.00' }, undefined);
    const withNewTier = computePriorityScore({ shopifyCreatedAt: daysAgo(2), totalPrice: '50.00' }, 'new');

    // 'new' carries a small positive weight (5), so it should score higher than no tier at all.
    expect(withNewTier).toBeGreaterThan(withUnknownTier);
  });
});
