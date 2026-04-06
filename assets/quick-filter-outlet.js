/**
 * Quick Filter — Outlet Quality (dropdown)
 * Filters product grid items based on the custom.outlet_quality metafield.
 *
 * Uses its own hidden class (outlet-quality-hidden) so it doesn't conflict
 * with the category quick-filter which uses quick-filter-hidden.
 * Items are hidden by CSS if they have EITHER class.
 */

(function () {
  'use strict';

  const SELECTORS = {
    select: '[data-outlet-filter-select]',
    jsonMap: '#quick-filter-outlet-map',
    productItem: '.product-grid__item',
  };

  // Own class — does not touch quick-filter-hidden
  const HIDDEN_CLASS = 'outlet-quality-hidden';

  function init() {
    const select = document.querySelector(SELECTORS.select);
    if (!select) return;

    const mapElement = document.querySelector(SELECTORS.jsonMap);
    if (!mapElement) return;

    let productFilterMap;
    try {
      productFilterMap = JSON.parse(mapElement.textContent);
    } catch (e) {
      return;
    }

    select.addEventListener('change', function () {
      const filterValue = select.value;
      const productItems = document.querySelectorAll(SELECTORS.productItem);

      productItems.forEach(function (item) {
        const productId = item.dataset.productId;
        const productQuality = productFilterMap[productId];

        if (filterValue === 'all') {
          item.classList.remove(HIDDEN_CLASS);
        } else if (productQuality === filterValue) {
          item.classList.remove(HIDDEN_CLASS);
        } else {
          item.classList.add(HIDDEN_CLASS);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
