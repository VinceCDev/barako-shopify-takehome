import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { shops, activityLogs } from './schema.js';

/*
 * DOCU: Finds a shop row by its myshopify.com domain.
 * @param {string} shopDomain - e.g. "barako-dev.myshopify.com"
 * @returns {Promise<Object|undefined>} - The shop row, or undefined if not installed.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function findShopByDomain(shopDomain) {
  const rows = await db.select().from(shops).where(eq(shops.shopDomain, shopDomain)).limit(1);
  return rows[0];
}

/*
 * DOCU: Creates the shop row on first install, or updates its access
 * token/scope if the shop re-installs (or re-authorizes with new scopes).
 * @param {Object} params - Shop installation details.
 * @param {string} params.shopDomain - The myshopify.com domain.
 * @param {string} params.accessToken - The offline access token from OAuth.
 * @param {string} params.scope - The comma-separated granted scopes.
 * @returns {Promise<Object>} - The upserted shop row.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function upsertShop({ shopDomain, accessToken, scope }) {
  const existing = await findShopByDomain(shopDomain);

  if (existing) {
    await db
      .update(shops)
      .set({ accessToken, scope, uninstalledAt: null })
      .where(eq(shops.id, existing.id));
    await logActivity({
      shopId: existing.id,
      module: 'system',
      entityType: 'shop',
      entityId: existing.id,
      action: 'reauthorized',
      message: `${shopDomain} re-authorized the app.`,
    });
    return findShopByDomain(shopDomain);
  }

  const [result] = await db.insert(shops).values({ shopDomain, accessToken, scope });
  const created = await findShopByDomain(shopDomain);
  await logActivity({
    shopId: created.id,
    module: 'system',
    entityType: 'shop',
    entityId: created.id,
    action: 'installed',
    message: `${shopDomain} installed the app.`,
  });
  return created;
}

/*
 * DOCU: Records one row in the shared activity_logs table — the single
 * history feed used by all three modules (inventory, loyalty,
 * fulfillment) plus system events like install/uninstall.
 * @param {Object} entry - The activity entry.
 * @param {number} entry.shopId - The owning shop's id.
 * @param {'inventory'|'loyalty'|'fulfillment'|'system'} entry.module - Which module logged this.
 * @param {'product'|'customer'|'order'|'shop'} entry.entityType - What kind of record this is about.
 * @param {number} entry.entityId - The id of that record.
 * @param {string} entry.action - A short machine-readable action name.
 * @param {string} entry.message - A human-readable description shown in the Activity page.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function logActivity({ shopId, module, entityType, entityId, action, message }) {
  await db.insert(activityLogs).values({ shopId, module, entityType, entityId, action, message });
}
