/**
 * Client-side-only favorites: no backend, no customer account sync — just
 * a per-device localStorage list. Wraps every localStorage call in
 * try/catch since it can throw in private browsing or a sandboxed
 * preview iframe, and the heart button should just no-op rather than
 * error in that case.
 *
 * Exposes window.BarakoFavorites so the quick-view modal's favorite
 * button (not part of the static per-card button list below, since it's
 * one shared button reused for whichever product's modal is open) can
 * read and toggle the same stored list.
 */
window.BarakoFavorites = (function () {
  const STORAGE_KEY = 'barako_favorites';

  /*
   * DOCU: Reads the stored list of favorited product IDs.
   * @returns {string[]} - Favorited product IDs, or an empty array if none stored or storage is unavailable.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const readFavorites = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  };

  /*
   * DOCU: Persists the given list of favorited product IDs.
   * @param {string[]} ids - The full favorites list to save.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const writeFavorites = (ids) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      // Storage unavailable (private mode, sandboxed iframe, etc.) — the
      // button still visually toggles for this page view, it just won't persist.
    }
  };

  /*
   * DOCU: Checks whether a product is already favorited.
   * @param {string|number} id - The product ID to check.
   * @returns {boolean} - True if the product is in the favorites list.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const isFavorited = (id) => readFavorites().indexOf(String(id)) !== -1;

  /*
   * DOCU: Adds or removes a product from the favorites list.
   * @param {string|number} id - The product ID to toggle.
   * @returns {boolean} - True if the product is now favorited, false if it was just removed.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const toggle = (id) => {
    const productId = String(id);
    const current = readFavorites();
    const index = current.indexOf(productId);
    let nowFavorited;

    if (index === -1) {
      current.push(productId);
      nowFavorited = true;
    } else {
      current.splice(index, 1);
      nowFavorited = false;
    }

    writeFavorites(current);
    return nowFavorited;
  };

  /*
   * DOCU: Syncs a favorite button's visual/ARIA state to match whether the
   * product is favorited.
   * @param {HTMLElement} button - The favorite-toggle button element.
   * @param {boolean} favorited - Whether the product is currently favorited.
   *
   * Last Updated: 2026-09-28
   * Author: Vince Allen
   * Last Updated By: Vince Allen
   */
  const applyState = (button, favorited) => {
    button.setAttribute('aria-pressed', favorited ? 'true' : 'false');
    const label = favorited ? button.getAttribute('data-remove-label') : button.getAttribute('data-add-label');
    if (label) button.setAttribute('aria-label', label);
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-favorite-toggle]').forEach((button) => {
      const id = button.getAttribute('data-product-id');
      if (id) applyState(button, isFavorited(id));

      button.addEventListener('click', () => {
        const currentId = button.getAttribute('data-product-id');
        if (!currentId) return;
        const nowFavorited = toggle(currentId);
        applyState(button, nowFavorited);

        if (window.BarakoToast) {
          const toastText = nowFavorited
            ? button.getAttribute('data-added-toast')
            : button.getAttribute('data-removed-toast');
          const toastTitle = nowFavorited
            ? button.getAttribute('data-added-toast-title')
            : button.getAttribute('data-removed-toast-title');
          if (toastText) window.BarakoToast.show(toastText, { title: toastTitle });
        }
      });
    });
  });

  return {
    isFavorited,
    toggle,
    applyState,
  };
})();
