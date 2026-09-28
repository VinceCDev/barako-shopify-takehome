/**
 * Drizzle ORM schema for Barako Merchant Tools.
 *
 * Five related tables:
 *   shops          - one row per store that installs the app; also holds
 *                    the OAuth access token (our own session storage,
 *                    rather than a black-box session-storage package, so
 *                    the OAuth flow stays auditable end to end)
 *   products       - synced from Shopify, plus our own inventory/reorder
 *                    settings (module 1: Low-Stock & Reorder Alerts)
 *   customers      - synced from Shopify, plus our own computed loyalty
 *                    score/tier (module 2: Customer Loyalty Scoring)
 *   orders         - synced from Shopify, plus our own computed
 *                    fulfillment priority score (module 3: Order
 *                    Fulfillment Priority Queue) — also the source data
 *                    for both sales velocity (module 1) and loyalty
 *                    recency/frequency/monetary (module 2)
 *   activity_logs  - a single, unified history table across all three
 *                    modules, rather than one log table per module —
 *                    one merchant-facing "Activity" feed, one schema to
 *                    reason about, and new modules don't need a new log
 *                    table to stay consistent with the others
 */
import {
  mysqlTable,
  int,
  bigint,
  varchar,
  decimal,
  timestamp,
  mysqlEnum,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const shops = mysqlTable('shops', {
  id: int('id').autoincrement().primaryKey(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  accessToken: varchar('access_token', { length: 255 }).notNull(),
  scope: varchar('scope', { length: 512 }),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  uninstalledAt: timestamp('uninstalled_at'),
}, (table) => ({
  shopDomainUnique: uniqueIndex('shops_shop_domain_unique').on(table.shopDomain),
}));

export const products = mysqlTable('products', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id),
  shopifyProductId: bigint('shopify_product_id', { mode: 'number' }).notNull(),
  shopifyVariantId: bigint('shopify_variant_id', { mode: 'number' }),
  title: varchar('title', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  currentStock: int('current_stock').notNull().default(0),
  // Merchant-configurable per module 1: below this, the product is "Low".
  reorderThreshold: int('reorder_threshold').notNull().default(10),
  // How many days of stock the recommended reorder quantity should cover.
  leadTimeDays: int('lead_time_days').notNull().default(14),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  shopIdx: index('products_shop_idx').on(table.shopId),
  variantUnique: uniqueIndex('products_shop_variant_unique').on(table.shopId, table.shopifyVariantId),
}));

export const customers = mysqlTable('customers', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id),
  shopifyCustomerId: bigint('shopify_customer_id', { mode: 'number' }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  orderCount: int('order_count').notNull().default(0),
  totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).notNull().default('0.00'),
  lastOrderAt: timestamp('last_order_at'),
  // Computed by services/loyaltyLogic.js — see that file's DOCU block for
  // the exact RFM-style formula.
  loyaltyScore: decimal('loyalty_score', { precision: 8, scale: 2 }).notNull().default('0.00'),
  loyaltyTier: mysqlEnum('loyalty_tier', ['new', 'regular', 'vip', 'at_risk']).notNull().default('new'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  shopIdx: index('customers_shop_idx').on(table.shopId),
  customerUnique: uniqueIndex('customers_shop_customer_unique').on(table.shopId, table.shopifyCustomerId),
}));

export const orders = mysqlTable('orders', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id),
  customerId: int('customer_id').references(() => customers.id),
  shopifyOrderId: bigint('shopify_order_id', { mode: 'number' }).notNull(),
  orderNumber: varchar('order_number', { length: 50 }),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  fulfillmentStatus: mysqlEnum('fulfillment_status', ['unfulfilled', 'in_progress', 'fulfilled']).notNull().default('unfulfilled'),
  // Computed by services/fulfillmentLogic.js.
  priorityScore: decimal('priority_score', { precision: 8, scale: 2 }).notNull().default('0.00'),
  shopifyCreatedAt: timestamp('shopify_created_at').notNull(),
  fulfilledAt: timestamp('fulfilled_at'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  shopIdx: index('orders_shop_idx').on(table.shopId),
  customerIdx: index('orders_customer_idx').on(table.customerId),
  orderUnique: uniqueIndex('orders_shop_order_unique').on(table.shopId, table.shopifyOrderId),
}));

// One row per line item per order — this is what lets module 1 compute
// real per-product sales velocity (units of THIS product sold recently),
// rather than guessing from the order total alone.
export const orderLineItems = mysqlTable('order_line_items', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull().references(() => orders.id),
  productId: int('product_id').references(() => products.id),
  quantity: int('quantity').notNull().default(1),
  price: decimal('price', { precision: 12, scale: 2 }).notNull().default('0.00'),
}, (table) => ({
  orderIdx: index('order_line_items_order_idx').on(table.orderId),
  productIdx: index('order_line_items_product_idx').on(table.productId),
}));

export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').autoincrement().primaryKey(),
  shopId: int('shop_id').notNull().references(() => shops.id),
  module: mysqlEnum('module', ['inventory', 'loyalty', 'fulfillment', 'system']).notNull(),
  entityType: mysqlEnum('entity_type', ['product', 'customer', 'order', 'shop']).notNull(),
  entityId: int('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  shopIdx: index('activity_logs_shop_idx').on(table.shopId),
  entityIdx: index('activity_logs_entity_idx').on(table.entityType, table.entityId),
}));

export const shopsRelations = relations(shops, ({ many }) => ({
  products: many(products),
  customers: many(customers),
  orders: many(orders),
  activityLogs: many(activityLogs),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  shop: one(shops, { fields: [products.shopId], references: [shops.id] }),
  lineItems: many(orderLineItems),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  shop: one(shops, { fields: [customers.shopId], references: [shops.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  shop: one(shops, { fields: [orders.shopId], references: [shops.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  lineItems: many(orderLineItems),
}));

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderLineItems.productId], references: [products.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  shop: one(shops, { fields: [activityLogs.shopId], references: [shops.id] }),
}));
