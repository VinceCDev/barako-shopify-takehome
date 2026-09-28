import { describe, it, expect } from 'vitest';
import { computeReorderStatus } from './inventoryLogic.js';

describe('computeReorderStatus', () => {
  it('returns "ok" with no reorder needed when a product has no recent sales', () => {
    const result = computeReorderStatus({ currentStock: 50, leadTimeDays: 14 }, 0);

    expect(result.salesVelocity).toBe(0);
    expect(result.daysUntilStockout).toBeNull();
    expect(result.alertLevel).toBe('ok');
    expect(result.recommendedReorderQty).toBe(0);
  });

  it('flags "critical" when fewer than 7 days of stock remain at the current velocity', () => {
    // 5 units sold/day, 20 in stock -> 4 days until stockout.
    const result = computeReorderStatus({ currentStock: 20, leadTimeDays: 14 }, 150);

    expect(result.salesVelocity).toBe(5);
    expect(result.daysUntilStockout).toBe(4);
    expect(result.alertLevel).toBe('critical');
    expect(result.recommendedReorderQty).toBeGreaterThan(0);
  });

  it('flags "low" when stockout is beyond 7 days but before the lead time arrives', () => {
    // 1 unit sold/day, 10 in stock -> 10 days until stockout, lead time is 14 days.
    const result = computeReorderStatus({ currentStock: 10, leadTimeDays: 14 }, 30);

    expect(result.daysUntilStockout).toBe(10);
    expect(result.alertLevel).toBe('low');
    // Demand during lead time (1 * 14 = 14) minus what's on hand (10) = 4.
    expect(result.recommendedReorderQty).toBe(4);
  });

  it('flags "ok" and recommends nothing when stock comfortably outlasts the lead time', () => {
    // 1 unit sold/day, 100 in stock -> 100 days until stockout, well past the 14-day lead time.
    const result = computeReorderStatus({ currentStock: 100, leadTimeDays: 14 }, 30);

    expect(result.alertLevel).toBe('ok');
    expect(result.recommendedReorderQty).toBe(0);
  });

  it('never recommends fewer than 1 unit once a reorder is actually needed', () => {
    // Demand during lead time barely exceeds current stock.
    const result = computeReorderStatus({ currentStock: 13, leadTimeDays: 14 }, 30);

    expect(result.recommendedReorderQty).toBeGreaterThanOrEqual(1);
  });
});
