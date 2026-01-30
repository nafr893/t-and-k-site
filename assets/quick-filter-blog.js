/**
 * Quick Filter Blog
 * Filters blog post items based on custom.blog_category metafield values.
 * Uses index-based mapping since blog-post-item elements don't have data-article-id.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter-blog',
    button: '.quick-filter-blog__button',
    activeButton: '.quick-filter-blog__button--active',
    jsonMap: '#quick-filter-blog-map',
    blogItem: '.blog-post-item',
  };

  const CLASSES = {
    active: 'quick-filter-blog__button--active',
    hidden: 'quick-filter-blog-hidden',
  };

  function init() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    const mapElement = document.querySelector(SELECTORS.jsonMap);
    if (!mapElement) return;

    let articleFilterMap;
    try {
      articleFilterMap = JSON.parse(mapElement.textContent);
    } catch (e) {
      console.error('Quick Filter Blog: Failed to parse article filter map', e);
      return;
    }

    const buttons = container.querySelectorAll(SELECTORS.button);
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        handleFilterClick(button, buttons, articleFilterMap);
      });
    });
  }

  function handleFilterClick(clickedButton, allButtons, articleFilterMap) {
    // Update active state
    allButtons.forEach((btn) => {
      btn.classList.remove(CLASSES.active);
      btn.setAttribute('aria-pressed', 'false');
    });
    clickedButton.classList.add(CLASSES.active);
    clickedButton.setAttribute('aria-pressed', 'true');

    const filterValue = clickedButton.dataset.filter;
    const blogItems = document.querySelectorAll(SELECTORS.blogItem);

    blogItems.forEach((item, index) => {
      const articleCategory = articleFilterMap[index.toString()];

      if (filterValue === 'all') {
        item.classList.remove(CLASSES.hidden);
      } else if (articleCategory === filterValue) {
        item.classList.remove(CLASSES.hidden);
      } else {
        item.classList.add(CLASSES.hidden);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
