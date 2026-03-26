(function () {
  'use strict';

  /**
   * BundleProduct
   *
   * Handles per-component variant selection and multi-item cart add
   * for the bundle-product section.
   */
  class BundleProduct {
    /** @param {HTMLElement} el */
    constructor(el) {
      this.el = el;
      this.addBtn = el.querySelector('[data-bundle-add]');
      this.errorEl = el.querySelector('[data-bundle-error]');
      this.componentCards = Array.from(el.querySelectorAll('[data-bundle-component]'));

      /** @type {Array<{ title: string, variants: object[], selectedOptions: (string|null)[], selectedVariantId: number|null }>} */
      this.state = this.componentCards.map((card) => {
        const raw = card.querySelector('[data-variants-json]');
        let variants = [];
        try {
          variants = raw ? JSON.parse(raw.textContent) : [];
        } catch (_) {}

        const optionGroupCount = card.querySelectorAll('[data-option-group]').length;

        return {
          title: card.dataset.componentTitle || '',
          variants,
          selectedOptions: new Array(optionGroupCount).fill(null),
          selectedVariantId: null,
        };
      });

      this.#bindEvents();
      this.#markUnavailableOptions();
    }

    #bindEvents() {
      this.componentCards.forEach((card, componentIndex) => {
        card.querySelectorAll('[data-option-btn]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const optionIndex = parseInt(btn.dataset.optionIndex, 10);
            const value = btn.dataset.value;
            this.#onOptionSelect(componentIndex, optionIndex, value, btn);
          });
        });
      });

      this.addBtn && this.addBtn.addEventListener('click', () => this.#addToCart());
    }

    /**
     * Mark option buttons unavailable based on which variants exist.
     */
    #markUnavailableOptions() {
      this.componentCards.forEach((card, componentIndex) => {
        const { variants } = this.state[componentIndex];
        const optionGroups = Array.from(card.querySelectorAll('[data-option-group]'));

        optionGroups.forEach((group, optionIndex) => {
          group.querySelectorAll('[data-option-btn]').forEach((btn) => {
            const value = btn.dataset.value;
            const hasAvailableVariant = variants.some((v) => {
              return v['option' + (optionIndex + 1)] === value && v.available;
            });
            btn.classList.toggle('is-unavailable', !hasAvailableVariant);
          });
        });
      });
    }

    /**
     * @param {number} componentIndex
     * @param {number} optionIndex
     * @param {string} value
     * @param {HTMLElement} btn
     */
    #onOptionSelect(componentIndex, optionIndex, value, btn) {
      const card = this.componentCards[componentIndex];
      const compState = this.state[componentIndex];

      // Skip unavailable options
      if (btn.classList.contains('is-unavailable')) return;

      // Update active button in this option group
      card
        .querySelectorAll(`[data-option-group="${optionIndex}"] [data-option-btn]`)
        .forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // Update selected label
      const labelEl = card.querySelector(`[data-selected-label-${optionIndex}]`);
      if (labelEl) labelEl.textContent = value;

      // Update state
      compState.selectedOptions[optionIndex] = value;

      // Resolve variant
      this.#resolveVariant(componentIndex);
    }

    /** @param {number} componentIndex */
    #resolveVariant(componentIndex) {
      const card = this.componentCards[componentIndex];
      const compState = this.state[componentIndex];
      const { variants, selectedOptions } = compState;

      // Need all options selected
      if (selectedOptions.some((o) => o === null)) {
        compState.selectedVariantId = null;
        return;
      }

      const match = variants.find((v) =>
        selectedOptions.every((val, i) => v['option' + (i + 1)] === val)
      );

      const statusEl = card.querySelector('[data-component-status]');

      if (!match) {
        compState.selectedVariantId = null;
        if (statusEl) {
          statusEl.textContent = 'This combination is unavailable';
          statusEl.dataset.state = 'error';
        }
        return;
      }

      if (!match.available) {
        compState.selectedVariantId = null;
        if (statusEl) {
          statusEl.textContent = 'Out of stock';
          statusEl.dataset.state = 'unavailable';
        }
        return;
      }

      compState.selectedVariantId = match.id;

      if (statusEl) {
        statusEl.textContent = selectedOptions.join(' / ');
        statusEl.dataset.state = 'available';
      }

      // Swap component image to variant image if one exists
      if (match.featured_image) {
        const imgEl = card.querySelector('[data-component-image]');
        if (imgEl) {
          const src = match.featured_image.src;
          // Use a reasonably sized version
          imgEl.src = src.includes('?')
            ? src + '&width=600'
            : src + '?width=600';
        }
      }
    }

    async #addToCart() {
      this.#hideError();

      // Validate: all components must have a selected available variant
      const incomplete = this.state.filter((s) => s.selectedVariantId === null);
      if (incomplete.length > 0) {
        const names = incomplete.map((s) => s.title).join(', ');
        this.#showError(
          'Please select all options for: ' + names
        );
        return;
      }

      const items = this.state.map((s) => ({ id: s.selectedVariantId, quantity: 1 }));

      this.addBtn.disabled = true;
      const originalLabel = this.addBtn.textContent;
      this.addBtn.textContent = 'Adding…';

      try {
        const addRes = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (!addRes.ok) {
          const data = await addRes.json().catch(() => ({}));
          throw new Error(data.description || 'Could not add to cart. Please try again.');
        }

        const cart = await fetch('/cart.js', {
          headers: { Accept: 'application/json' },
        }).then((r) => r.json());

        // Trigger the cart drawer / cart icon update (same event as system-builder.js)
        document.dispatchEvent(
          new CustomEvent('cart:update', {
            bubbles: true,
            detail: { resource: cart },
          })
        );
      } catch (err) {
        this.#showError(err.message || 'Something went wrong. Please try again.');
      } finally {
        this.addBtn.disabled = false;
        this.addBtn.textContent = originalLabel;
      }
    }

    /** @param {string} msg */
    #showError(msg) {
      if (!this.errorEl) return;
      this.errorEl.textContent = msg;
      this.errorEl.style.display = 'block';
    }

    #hideError() {
      if (!this.errorEl) return;
      this.errorEl.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('[data-bundle-product]');
    if (el) new BundleProduct(el);
  });
})();
