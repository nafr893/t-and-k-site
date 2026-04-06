/**
 * Quick Filter — Outlet Quality
 * Filters product grid items based on the custom.outlet_quality metafield.
 * Follows the same pattern as quick-filter.js but uses separate selectors
 * so both filters can coexist on the same page without conflict.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter-outlet',
    button: '.quick-filter-outlet [data-outlet-filter]',
    jsonMap: '#quick-filter-outlet-map',
    productItem: '.product-grid__item',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  function init() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    const mapElement = document.querySelector(SELECTORS.jsonMap);
    if (!mapElement) return;

    let productFilterMap;
    try {
      productFilterMap = JSON.parse(mapElement.textContent);
    } catch (e) {
      return;
    }

    const buttons = container.querySelectorAll('[data-outlet-filter]');
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        handleFilterClick(button, buttons, productFilterMap);
      });
    });
  }

  function handleFilterClick(clickedButton, allButtons, productFilterMap) {
    allButtons.forEach((btn) => {
      btn.classList.remove(CLASSES.active);
      btn.setAttribute('aria-pressed', 'false');
    });
    clickedButton.classList.add(CLASSES.active);
    clickedButton.setAttribute('aria-pressed', 'true');

    const filterValue = clickedButton.dataset.outletFilter;
    const productItems = document.querySelectorAll(SELECTORS.productItem);

    productItems.forEach((item) => {
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
