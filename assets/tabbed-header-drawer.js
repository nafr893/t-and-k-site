import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';
import { onAnimationEnd, removeWillChangeOnAnimationEnd } from '@theme/utilities';

/**
 * A custom element that manages the tabbed mobile navigation drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDetailsElement} details - The details element.
 * @property {HTMLElement[]} tabButtons - Array of tab button elements.
 * @property {HTMLElement[]} tabPanels - Array of tab panel elements.
 *
 * @extends {Component<Refs>}
 */
class TabbedHeaderDrawer extends Component {
  requiredRefs = ['details', 'tabButtons[]', 'tabPanels[]'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keyup', this.#onKeyUp);
    this.#setupAnimatedElementListeners();
    this.#handleDeepLink();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keyup', this.#onKeyUp);
  }

  /**
   * Close the drawer when the Escape key is pressed
   * @param {KeyboardEvent} event
   */
  #onKeyUp = (event) => {
    if (event.key !== 'Escape') return;

    const details = this.#getDetailsElement(event);
    if (details === this.refs.details) {
      this.close();
    } else {
      this.#closeSubmenu(details);
    }
  };

  /**
   * @returns {boolean} Whether the drawer is open
   */
  get isOpen() {
    return this.refs.details.hasAttribute('open');
  }

  /**
   * Get the closest details element to the event target
   * @param {Event | undefined} event
   * @returns {HTMLDetailsElement}
   */
  #getDetailsElement(event) {
    if (!(event?.target instanceof Element)) return this.refs.details;

    return event.target.closest('details') ?? this.refs.details;
  }

  /**
   * Toggle the drawer
   */
  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  /**
   * Open the drawer to a specific tab
   * @param {Event | string} [eventOrTabId] - Event or tab ID string
   */
  open(eventOrTabId) {
    const details = this.refs.details;
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'true');

    this.preventInitialAccordionAnimations(details);
    requestAnimationFrame(() => {
      details.classList.add('menu-open');

      // If a tab ID is provided as a string, switch to that tab
      if (typeof eventOrTabId === 'string') {
        this.switchTab(eventOrTabId);
      } else if (eventOrTabId instanceof Event) {
        // Handle submenu opening
        const submenuDetails = this.#getDetailsElement(eventOrTabId);
        if (submenuDetails !== this.refs.details) {
          submenuDetails.classList.add('menu-open');
        }
      }

      // Wait for the drawer animation to complete before trapping focus
      const drawer = details.querySelector('.tabbed-drawer');
      onAnimationEnd(drawer || details, () => trapFocus(details), { subtree: false });
    });
  }

  /**
   * Switch to a specific tab
   * @param {string | object} tabIdOrData - Tab ID string or data object with tabId property
   */
  switchTab(tabIdOrData) {
    // Handle both string and object parameter formats
    const tabId = typeof tabIdOrData === 'string' ? tabIdOrData : tabIdOrData?.tabId;

    if (!tabId) return;

    // Hide all panels
    this.refs.tabPanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    });

    // Remove active state from all tab buttons
    this.refs.tabButtons.forEach((button) => {
      button.classList.remove('tabbed-drawer__tab--active');
      button.setAttribute('aria-selected', 'false');
    });

    // Show the selected panel
    const targetPanel = this.refs.tabPanels.find((panel) => panel.dataset.tab === tabId);
    if (targetPanel) {
      targetPanel.hidden = false;
      targetPanel.setAttribute('aria-hidden', 'false');
    }

    // Activate the selected tab button
    const targetButton = this.refs.tabButtons.find((button) => button.dataset.tab === tabId);
    if (targetButton) {
      targetButton.classList.add('tabbed-drawer__tab--active');
      targetButton.setAttribute('aria-selected', 'true');
    }

    // Save tab state
    this.#saveTabState(tabId);
  }

  /**
   * Go back from a submenu or close the drawer
   * @param {Event} [event]
   */
  back(event) {
    const details = this.#getDetailsElement(event);
    if (details === this.refs.details) {
      this.close();
    } else {
      this.#closeSubmenu(details);
    }
  }

  /**
   * Close the drawer
   */
  close() {
    const details = this.refs.details;
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');

    // Wait for the drawer animation to complete
    const drawer = details.querySelector('.tabbed-drawer');

    onAnimationEnd(
      drawer || details,
      () => {
        this.#resetDrawer(details);
        removeTrapFocus();

        // Reset any open submenus
        const openDetails = this.querySelectorAll('details[open]:not(accordion-custom > details)');
        openDetails.forEach((submenu) => {
          this.#resetDrawer(submenu);
        });
      },
      { subtree: false }
    );
  }

  /**
   * Close a submenu
   * @param {HTMLDetailsElement} details
   */
  #closeSubmenu(details) {
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');

    const submenu = details.querySelector('.menu-drawer__submenu');

    onAnimationEnd(
      submenu || details,
      () => {
        this.#resetDrawer(details);
        trapFocus(this.refs.details);
      },
      { subtree: false }
    );
  }

  /**
   * Reset a details element to its original state
   * @param {HTMLDetailsElement} element
   */
  #resetDrawer(element) {
    element.classList.remove('menu-open');
    element.removeAttribute('open');
    element.querySelector('summary')?.setAttribute('aria-expanded', 'false');
  }

  /**
   * Attach animationend event listeners to all animated elements
   */
  #setupAnimatedElementListeners() {
    const allAnimated = this.querySelectorAll('.menu-drawer__animated-element');
    allAnimated.forEach((element) => {
      element.addEventListener('animationend', removeWillChangeOnAnimationEnd);
    });
  }

  /**
   * Temporarily disables accordion animations to prevent unwanted transitions when the drawer opens.
   * @param {HTMLDetailsElement} details - The details element containing the accordions
   */
  preventInitialAccordionAnimations(details) {
    const content = details.querySelectorAll('accordion-custom .details-content');

    content.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.classList.add('details-content--no-animation');
      }
    });

    setTimeout(() => {
      content.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.classList.remove('details-content--no-animation');
        }
      });
    }, 100);
  }

  /**
   * Handle deep linking - check URL params and localStorage for initial tab
   */
  #handleDeepLink() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get('drawer');
      const tabFromStorage = localStorage.getItem('lastActiveTab');

      const initialTab = tabFromUrl || tabFromStorage || 'shop';

      // Set initial tab without animation
      requestAnimationFrame(() => {
        this.switchTab(initialTab);
      });
    } catch (error) {
      // If localStorage is not available, default to shop tab
      this.switchTab('shop');
    }
  }

  /**
   * Save the current tab state to localStorage
   * @param {string} tabId
   */
  #saveTabState(tabId) {
    try {
      localStorage.setItem('lastActiveTab', tabId);
    } catch (error) {
      // Silently fail if localStorage is not available
    }
  }
}

if (!customElements.get('tabbed-header-drawer')) {
  customElements.define('tabbed-header-drawer', TabbedHeaderDrawer);
}
