import 'dotenv/config';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

/**
 * The core Shopify API client — configured directly with the low-level
 * @shopify/shopify-api library (not a higher-level framework wrapper),
 * so the OAuth handshake in auth.js is fully visible and auditable
 * rather than hidden behind a black box.
 */
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(','),
  hostName: new URL(process.env.SHOPIFY_APP_URL).host,
  hostScheme: new URL(process.env.SHOPIFY_APP_URL).protocol.replace(':', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});
