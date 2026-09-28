/**
 * Small shared helper, used by the product page (after /cart/add.js) and
 * the cart page (after /cart/change.js) to keep the header's cart count
 * in sync without a full page reload. Vanilla JS, no dependencies.
 *
 * The header badge behaves like a notification indicator: it shows only
 * when the cart holds items the shopper hasn't seen yet (added since their
 * last visit to the cart page), and clears once they view the cart. The
 * "seen" count is remembered in sessionStorage so it survives navigation
 * within the session but resets for a new one.
 */
window.BarakoCart = (function () {
  const SEEN_KEY = 'barako:cart-seen-count';

  /*
   * DOCU: Reads the last cart item count the shopper has "seen" (i.e. was
   * on the cart page for) from sessionStorage.
   * @returns {number} - The seen count, or 0 if none stored or storage is unavailable.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const getSeenCount = () => {
    try {
      return parseInt(sessionStorage.getItem(SEEN_KEY), 10) || 0;
    } catch (error) {
      return 0;
    }
  };

  /*
   * DOCU: Persists the given count as the "seen" count in sessionStorage.
   * @param {number} count - The cart item count to remember as seen.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const setSeenCount = (count) => {
    try {
      sessionStorage.setItem(SEEN_KEY, String(count));
    } catch (error) {
      // Storage unavailable (private mode, etc.) — badge just won't persist
      // across page loads, which is a harmless degradation.
    }
  };

  /*
   * DOCU: Checks whether the current page is the cart page.
   * @returns {boolean} - True when body[data-template] is "cart".
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const isCartPage = () => document.body.getAttribute('data-template') === 'cart';

  /*
   * DOCU: Updates the header cart badge's text and visibility based on
   * whether the given count differs from what's already been seen.
   * @param {number} itemCount - The cart's current total item count.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const renderBadge = (itemCount) => {
    const badge = document.querySelector('[data-cart-badge]');
    if (!badge) return;

    badge.textContent = itemCount;
    badge.setAttribute('data-count', itemCount);

    const unseen = itemCount > 0 && itemCount !== getSeenCount();
    badge.hidden = !unseen;
  };

  /*
   * DOCU: Public entry point called after any cart mutation (add/change).
   * Marks the count as seen when already on the cart page, re-renders the
   * badge, and updates the cart link's screen-reader text.
   * @param {number} itemCount - The cart's current total item count.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const updateHeaderCount = (itemCount) => {
    const srText = document.querySelector('.header__cart-link .visually-hidden');

    if (isCartPage()) {
      setSeenCount(itemCount);
    }
    renderBadge(itemCount);

    if (srText) {
      srText.textContent = itemCount === 1 ? '1 item in cart' : `${itemCount} items in cart`;
    }
  };

  /*
   * DOCU: Fetches the current cart state as JSON.
   * @returns {Promise<Object>} - Resolves with the parsed /cart.js response.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const fetchCart = () =>
    fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((response) => response.json());

  // Initialize the badge as soon as this script runs, from the server-rendered count.
  const initialBadge = document.querySelector('[data-cart-badge]');
  const initialCount = initialBadge ? parseInt(initialBadge.getAttribute('data-count'), 10) || 0 : 0;

  if (isCartPage()) {
    setSeenCount(initialCount);
    if (initialBadge) initialBadge.hidden = true;
  } else {
    renderBadge(initialCount);
  }

  return {
    updateHeaderCount,
    fetchCart,
  };
})();
