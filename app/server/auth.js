import express from 'express';
import { shopify } from './shopify.js';
import { upsertShop } from './db/shopRepository.js';

export const authRouter = express.Router();

/*
 * DOCU: Step 1 of the OAuth handshake. A merchant lands here (usually via
 * the Shopify App Store "Install" button, or Shopify redirecting an
 * embedded app that has no valid session yet) with ?shop=<domain> in the
 * query string. Redirects them to Shopify's own authorization screen.
 * @param {import('express').Request} req - Must have req.query.shop.
 * @param {import('express').Response} res
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
authRouter.get('/api/auth', async (req, res) => {
  let shop;
  try {
    shop = shopify.utils.sanitizeShop(req.query.shop, true);
  } catch (error) {
    shop = null;
  }

  if (!shop) {
    res.status(400).send('Missing or invalid ?shop parameter. Expected something like ?shop=your-store.myshopify.com');
    return;
  }

  await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/*
 * DOCU: Step 2 of the OAuth handshake. Shopify redirects back here after
 * the merchant approves the requested scopes, with a one-time code this
 * exchanges for a permanent (offline) access token. That token is saved
 * via upsertShop, then the merchant is sent into the embedded app.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
authRouter.get('/api/auth/callback', async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;
    await upsertShop({
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
    });

    // Land back in the embedded app, inside the Shopify Admin iframe.
    res.redirect(`https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
  } catch (error) {
    console.error('OAuth callback failed:', error);
    res.status(500).send('Authentication failed. Please try installing the app again.');
  }
});
