/*
 * DOCU: Makes an authenticated fetch to our own backend, attaching the
 * current App Bridge session token as a Bearer header — this is what
 * server/verifyRequest.js checks on every /api/* route. App Bridge (the
 * global script tag loaded in index.html) exposes this on window.
 * @param {string} path - A path on our own server, e.g. "/api/inventory".
 * @param {RequestInit} [options] - Standard fetch options; JSON body is stringified automatically.
 * @returns {Promise<any>} - The parsed JSON response.
 * @throws {Error} - If the response is not ok.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export async function apiFetch(path, options = {}) {
  const token = await window.shopify.idToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  let body = options.body;
  if (body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(path, { ...options, headers, body });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request to ${path} failed (${response.status}).`);
  }
  return response.json();
}
