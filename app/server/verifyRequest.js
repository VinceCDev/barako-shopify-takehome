import { shopify } from './shopify.js';
import { findShopByDomain } from './db/shopRepository.js';

/*
 * DOCU: Express middleware protecting the API routes the embedded app's
 * frontend calls. App Bridge attaches a short-lived JWT ("session
 * token") to every authenticated fetch as an Authorization: Bearer
 * header; this decodes and verifies it, looks up the corresponding shop
 * in our own database, and attaches it to req.shop for downstream
 * routes. Responds 401 (with a header App Bridge recognizes) if the
 * token is missing/invalid, or if the shop was never installed.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function verifyRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing session token.' });
    return;
  }

  try {
    const payload = await shopify.session.decodeSessionToken(token);
    const shopDomain = payload.dest.replace('https://', '');
    const shop = await findShopByDomain(shopDomain);

    if (!shop || shop.uninstalledAt) {
      res.status(401).json({ error: 'Shop is not installed.' });
      return;
    }

    req.shop = shop;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid session token.' });
  }
}
