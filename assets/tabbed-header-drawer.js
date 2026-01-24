import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';
import { onAnimationEnd, removeWillChangeOnAnimationEnd } from '@theme/utilities';

/**
 * Tabbed mobile navigation drawer.
 * Uses same open/close lifecycle as header-drawer but keeps tab logic.
 */
class TabbedHeaderDrawer extends Component {
  // require only details to avoid missing-ref crash; tabs will be discovered via DOM
  requiredRefs = ['details'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keyup', this.#onKeyUp);
    this.#setupAnimatedElementListeners();
    this.#handleDeepLink();

    // discover tab buttons/panels inside the drawer (safe even if markup is delayed)
    this.#discoverTabs();

    // ensure pop-initial tab state if discovery happened late
    if (!this._tabsDiscovered) {
      // try again on next frame (handles some render timing cases)
      requestAnimationFrame(() => this.#discoverTabs());
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keyup', this.#onKeyUp);
  }

  #onKeyUp = (event) => {
    if (event.key !== 'Escape') return;

    const details = this.#getDetailsElement(event);
    if (details === this.refs.details) {
      this.close();
    } else {
      this.#closeSubmenu(details);
    }
  };

  get isOpen() {
    return this.refs?.details?.hasAttribute?.('open') ?? false;
  }

  #getDetailsElement(event) {
    if (!(event?.target instanceof Element)) return this.refs.details;
    return event.target.closest('details') ?? this.refs.details;
  }

  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  open(eventOrTabId) {
    const details = this.refs.details;
    const summary = details.querySelector('summary');
    if (!summary) return;

    summary.setAttribute('aria-expanded', 'true');

    this.preventInitialAccordionAnimations(details);
    requestAnimationFrame(() => {
      details.classList.add('menu-open');

      // If string given, switch tab
      if (typeof eventOrTabId === 'string') {
        this.switchTab(eventOrTabId);
      } else if (eventOrTabId instanceof Event) {
        const submenuDetails = this.#getDetailsElement(eventOrTabId);
        if (submenuDetails !== this.refs.details) submenuDetails.classList.add('menu-open');
      }

      const drawer = details.querySelector('.tabbed-drawer');
      onAnimationEnd(drawer || details, () => trapFocus(details), { subtree: false });
    });
  }

  switchTab(tabIdOrData) {
    const tabId = typeof tabIdOrData === 'string' ? tabIdOrData : tabIdOrData?.tabId;
    if (!tabId) return;

    this.#discoverTabs();

    if (!this.refs.tabPanels || !this.refs.tabButtons) return;

    this.refs.tabPanels.forEach((panel) => {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    });

    this.refs.tabButtons.forEach((button) => {
      button.classList.remove('tabbed-drawer__tab--active');
      button.setAttribute('aria-selected', 'false');
    });

    const targetPanel = this.refs.tabPanels.find((p) => p.dataset.tab === tabId);
    if (targetPanel) {
      targetPanel.hidden = false;
      targetPanel.setAttribute('aria-hidden', 'false');
    }

    const targetButton = this.refs.tabButtons.find((b) => b.dataset.tab === tabId);
    if (targetButton) {
      targetButton.classList.add('tabbed-drawer__tab--active');
      targetButton.setAttribute('aria-selected', 'true');
    }

    this.#saveTabState(tabId);
  }

  back(event) {
    const details = this.#getDetailsElement(event);
    if (details === this.refs.details) {
      this.close();
    } else {
      this.#closeSubmenu(details);
    }
  }

  close() {
    const details = this.refs.details;
    const summary = details.querySelector('summary');
    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');

    const drawer = details.querySelector('.tabbed-drawer');

    onAnimationEnd(
      drawer || details,
      () => {
        this.#resetDrawer(details);
        removeTrapFocus();

        const openDetails = this.querySelectorAll('details[open]:not(accordion-custom > details)');
        openDetails.forEach((submenu) => this.#resetDrawer(submenu));
      },
      { subtree: false }
    );
  }

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

  #resetDrawer(element) {
    element.classList.remove('menu-open');
    element.removeAttribute('open');
    element.querySelector('summary')?.setAttribute('aria-expanded', 'false');
  }

  #setupAnimatedElementListeners() {
    const allAnimated = this.querySelectorAll('.menu-drawer__animated-element');
    allAnimated.forEach((element) => {
      element.addEventListener('animationend', removeWillChangeOnAnimationEnd);
    });
  }

  preventInitialAccordionAnimations(details) {
    const content = details.querySelectorAll('accordion-custom .details-content');
    content.forEach((element) => {
      if (element instanceof HTMLElement) element.classList.add('details-content--no-animation');
    });
    setTimeout(() => {
      content.forEach((element) => {
        if (element instanceof HTMLElement) element.classList.remove('details-content--no-animation');
      });
    }, 100);
  }

  #handleDeepLink() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get('drawer');
      const tabFromStorage = localStorage.getItem('lastActiveTab');
      const initialTab = tabFromUrl || tabFromStorage || 'shop';

      requestAnimationFrame(() => {
        this.switchTab(initialTab);
      });
    } catch (error) {
      this.switchTab('shop');
    }
  }

  #saveTabState(tabId) {
    try {
      localStorage.setItem('lastActiveTab', tabId);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Discover tab buttons and panels via DOM (not relying on liquid refs).
   * Safe to call multiple times.
   */
  #discoverTabs() {
    try {
      const details = this.refs?.details;
      if (!details) return;

      const container = details.querySelector('.tabbed-drawer') ?? details;
      const tabButtons = Array.from(container.querySelectorAll('.tabbed-drawer__tab[data-tab]'));
      const tabPanels = Array.from(container.querySelectorAll('.tabbed-drawer__panel[data-tab]'));

      if (tabButtons.length) {
        this.refs.tabButtons = tabButtons;
        this.refs.tabButtons.forEach((btn) => {
          // attach delegated click to switch tab
          if (!btn.__tabListenerAttached) {
            btn.addEventListener('click', (e) => {
              const tab = btn.dataset.tab;
              if (tab) this.switchTab(tab);
            });
            btn.__tabListenerAttached = true;
          }
        });
      }

      if (tabPanels.length) this.refs.tabPanels = tabPanels;

      this._tabsDiscovered = true;
    } catch (err) {
      // noop — discovery can be retried later
    }
  }
}

if (!customElements.get('tabbed-header-drawer')) {
  customElements.define('tabbed-header-drawer', TabbedHeaderDrawer);
}
