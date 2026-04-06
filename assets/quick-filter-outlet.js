/**
 * Quick Filter — Outlet Quality (dropdown)
 * Filters product grid items based on the custom.outlet_quality metafield.
 */

(function () {
  'use strict';

  const SELECTORS = {
    select: '[data-outlet-filter-select]',
    jsonMap: '#quick-filter-outlet-map',
    productItem: '.product-grid__item',
  };

  const CLASSES = {
    hidden: 'quick-filter-hidden',
  };

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
          item.classList.remove(CLASSES.hidden);
        } else if (productQuality === filterValue) {
          item.classList.remove(CLASSES.hidden);
        } else {
          item.classList.add(CLASSES.hidden);
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
