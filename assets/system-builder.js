/**
 * System Builder Web Component — Harness Configurator
 * A simplified product configurator for harness models and accessories.
 */
class SystemBuilder extends HTMLElement {
  constructor() {
    super();

    // Track selected harness model handle (single-select)
    this.activeHarnessModel = null;

    // Track active accessory chip handles
    this.activeAccessories = new Set();

    // Track which products are selected for cart (keyed by variant ID)
    // Format: { variantId: { id, title, price, image, productTitle, productType, available, quantity } }
    this.selectedProducts = {};

    // Data storage
    this.data = {
      harnessModels: [],    // chip labels only
      harnessTypes: [],     // products linked to models
      harnessAccessories: [],
      accessories: []       // block accessories
    };
  }

  connectedCallback() {
    this.loadData();
    this.bindEvents();
    this.initializeState();
  }

  /**
   * Load metaobject data from embedded JSON
   */
  loadData() {
    const harnessModelsEl = this.querySelector('[data-harness-models]');
    const harnessTypesEl = this.querySelector('[data-harness-types]');
    const harnessAccessoriesEl = this.querySelector('[data-harness-accessories]');
    const accessoriesEl = this.querySelector('[data-accessories]');

    try {
      this.data.harnessModels = harnessModelsEl ? JSON.parse(harnessModelsEl.textContent) : [];
      this.data.harnessTypes = harnessTypesEl ? JSON.parse(harnessTypesEl.textContent) : [];
      this.data.harnessAccessories = harnessAccessoriesEl ? JSON.parse(harnessAccessoriesEl.textContent) : [];
      this.data.accessories = accessoriesEl ? JSON.parse(accessoriesEl.textContent) : [];
    } catch (e) {
      console.error('System Builder: Error parsing data', e);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chip]');
      if (chip) {
        this.handleChipClick(chip);
        return;
      }

      const productCard = e.target.closest('[data-product-card]');
      if (productCard) {
        this.handleProductCardClick(productCard);
        return;
      }

      const addToCartBtn = e.target.closest('[data-add-to-cart]');
      if (addToCartBtn) {
        this.handleAddToCart(addToCartBtn);
        return;
      }

      const removeBtn = e.target.closest('[data-summary-remove]');
      if (removeBtn) {
        this.handleRemoveFromSummary(removeBtn);
        return;
      }

      const quantityIncreaseBtn = e.target.closest('[data-quantity-increase]');
      if (quantityIncreaseBtn) {
        this.handleQuantityChange(quantityIncreaseBtn.dataset.quantityIncrease, 1);
        return;
      }

      const quantityDecreaseBtn = e.target.closest('[data-quantity-decrease]');
      if (quantityDecreaseBtn) {
        this.handleQuantityChange(quantityDecreaseBtn.dataset.quantityDecrease, -1);
        return;
      }
    });

    // Keyboard support for product cards
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const productCard = e.target.closest('[data-product-card]');
        if (productCard) {
          e.preventDefault();
          this.handleProductCardClick(productCard);
        }
      }
    });
  }

  /**
   * Initialize state — display block accessories, hide accessories step until a model is selected
   */
  initializeState() {
    // Hide accessories step until a harness model is selected
    this.updateAccessoriesVisibility();

    if (this.data.accessories.length > 0) {
      this.displayBlockAccessories();
    }

    this.updateSummary();
  }

  /**
   * Display harness product cards for the selected model (from harness_type entries)
   */
  displayHarnessModels(modelHandle) {
    const grid = this.querySelector('[data-harness-models-grid]');
    if (!grid) return;

    // Find all harness_type entries linked to this model
    const matchingTypes = this.data.harnessTypes.filter(ht =>
      ht.modelHandles && ht.modelHandles.includes(modelHandle)
    );

    // Collect all variants from matching types
    const allVariants = [];
    matchingTypes.forEach(ht => {
      if (ht.variants) {
        ht.variants.forEach(v => allVariants.push(v));
      }
    });

    if (allVariants.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = allVariants.map(variant => this.renderProductCard(variant, 'harness-model')).join('');
  }

  /**
   * Show/hide and filter the accessories step based on the selected harness model
   */
  updateAccessoriesVisibility() {
    const accessoriesStep = this.querySelector('[data-step="harness-accessories"]');
    if (!accessoriesStep) return;

    if (!this.activeHarnessModel) {
      accessoriesStep.hidden = true;
      return;
    }

    accessoriesStep.hidden = false;

    // Filter accessory chips — show only those linked to the selected harness model
    const chips = accessoriesStep.querySelectorAll('[data-chip][data-field="harness-accessory"]');
    chips.forEach(chip => {
      const handle = chip.dataset.value;
      const accessory = this.data.harnessAccessories.find(a => a.handle === handle);
      if (!accessory) return;

      // Show chip if its harnessTypeHandles includes the active model, or if no filter is set
      const isLinked = !accessory.harnessTypeHandles || accessory.harnessTypeHandles.length === 0
        || accessory.harnessTypeHandles.includes(this.activeHarnessModel);

      chip.style.display = isLinked ? '' : 'none';

      // If chip was active but is now hidden, deactivate it
      if (!isLinked && chip.classList.contains('system-builder__chip--selected')) {
        chip.classList.remove('system-builder__chip--selected');
        chip.setAttribute('aria-pressed', 'false');
        this.activeAccessories.delete(handle);
        this.removeAccessoryCards(handle);
      }
    });
  }

  /**
   * Handle chip click
   */
  handleChipClick(chip) {
    const field = chip.dataset.field;
    const value = chip.dataset.value;

    if (field === 'harness-model') {
      this.handleHarnessModelChipClick(chip, value);
    } else if (field === 'harness-accessory') {
      this.handleAccessoryChipClick(chip, value);
    }

    this.updateSummary();
  }

  /**
   * Handle harness model chip click — single-select
   */
  handleHarnessModelChipClick(chip, value) {
    const wasSelected = chip.classList.contains('system-builder__chip--selected');

    // Deselect all model chips
    this.querySelectorAll('[data-chip][data-field="harness-model"]').forEach(c => {
      c.classList.remove('system-builder__chip--selected');
      c.setAttribute('aria-pressed', 'false');
    });

    // Clear existing model product selections
    const modelGrid = this.querySelector('[data-harness-models-grid]');
    if (modelGrid) {
      modelGrid.querySelectorAll('[data-product-card]').forEach(card => {
        const variantId = card.dataset.variantId;
        if (variantId && this.selectedProducts[variantId]) {
          delete this.selectedProducts[variantId];
        }
      });
    }

    if (wasSelected) {
      // Deselect — clear model and hide accessories
      this.activeHarnessModel = null;
      if (modelGrid) modelGrid.innerHTML = '';

      // Clear all active accessories too
      this.activeAccessories.forEach(handle => this.removeAccessoryCards(handle));
      this.activeAccessories.clear();
      this.querySelectorAll('[data-chip][data-field="harness-accessory"]').forEach(c => {
        c.classList.remove('system-builder__chip--selected');
        c.setAttribute('aria-pressed', 'false');
      });
    } else {
      // Select new model
      chip.classList.add('system-builder__chip--selected');
      chip.setAttribute('aria-pressed', 'true');
      this.activeHarnessModel = value;
      this.displayHarnessModels(value);

      // Clear accessories from previous model
      this.activeAccessories.forEach(handle => this.removeAccessoryCards(handle));
      this.activeAccessories.clear();
      this.querySelectorAll('[data-chip][data-field="harness-accessory"]').forEach(c => {
        c.classList.remove('system-builder__chip--selected');
        c.setAttribute('aria-pressed', 'false');
      });
    }

    this.updateAccessoriesVisibility();
  }

  /**
   * Handle accessory chip click — multi-select toggle
   */
  handleAccessoryChipClick(chip, value) {
    const isSelected = chip.classList.contains('system-builder__chip--selected');

    if (isSelected) {
      chip.classList.remove('system-builder__chip--selected');
      chip.setAttribute('aria-pressed', 'false');
      this.activeAccessories.delete(value);
      this.removeAccessoryCards(value);
    } else {
      chip.classList.add('system-builder__chip--selected');
      chip.setAttribute('aria-pressed', 'true');
      this.activeAccessories.add(value);
      this.addAccessoryCards(value);
    }
  }

  /**
   * Add product cards for an accessory to the grid
   */
  addAccessoryCards(handle) {
    const grid = this.querySelector('[data-harness-accessories-grid]');
    if (!grid) return;

    const accessory = this.data.harnessAccessories.find(a => a.handle === handle);
    if (!accessory || !accessory.variants) return;

    const html = accessory.variants.map(variant =>
      `<div data-accessory-group="${handle}">${this.renderProductCard(variant, 'harness-accessory')}</div>`
    ).join('');

    grid.insertAdjacentHTML('beforeend', html);
  }

  /**
   * Remove product cards for an accessory from the grid
   */
  removeAccessoryCards(handle) {
    const grid = this.querySelector('[data-harness-accessories-grid]');
    if (!grid) return;

    // Deselect any selected products from this accessory before removing
    const cards = grid.querySelectorAll(`[data-accessory-group="${handle}"] [data-product-card]`);
    cards.forEach(card => {
      const variantId = card.dataset.variantId;
      if (variantId && this.selectedProducts[variantId]) {
        delete this.selectedProducts[variantId];
      }
    });

    // Remove the card containers
    grid.querySelectorAll(`[data-accessory-group="${handle}"]`).forEach(el => el.remove());
  }

  /**
   * Display block accessories
   */
  displayBlockAccessories() {
    const grid = this.querySelector('[data-accessories-grid]');
    if (!grid) return;

    grid.innerHTML = this.data.accessories.map(accessory =>
      this.renderProductCard(accessory, 'accessory')
    ).join('');
  }

  /**
   * Handle product card click — toggle selection
   */
  handleProductCardClick(card) {
    const isAvailable = card.dataset.available !== 'false';
    if (!isAvailable) return;

    const variantId = card.dataset.variantId;
    const productType = card.dataset.productType;
    if (!variantId || !productType) return;

    // Find the product data
    let productData = null;

    if (productType === 'harness-model') {
      for (const ht of this.data.harnessTypes) {
        productData = ht.variants?.find(v => String(v.id) === String(variantId));
        if (productData) break;
      }
    } else if (productType === 'harness-accessory') {
      for (const acc of this.data.harnessAccessories) {
        productData = acc.variants?.find(v => String(v.id) === String(variantId));
        if (productData) break;
      }
    } else if (productType === 'accessory') {
      productData = this.data.accessories.find(a => String(a.id) === String(variantId));
    }

    // Toggle selection
    if (this.selectedProducts[variantId]) {
      delete this.selectedProducts[variantId];
    } else if (productData) {
      this.selectedProducts[variantId] = {
        ...productData,
        productType,
        quantity: 1
      };
    }

    const isSelected = !!this.selectedProducts[variantId];
    card.classList.toggle('system-builder__product-card--selected', isSelected);
    card.setAttribute('aria-pressed', isSelected);

    this.updateSummary();
  }

  /**
   * Handle remove button click in summary
   */
  handleRemoveFromSummary(button) {
    const variantId = button.dataset.summaryRemove;
    if (!variantId || !this.selectedProducts[variantId]) return;

    delete this.selectedProducts[variantId];

    this.querySelectorAll(`[data-product-card][data-variant-id="${variantId}"]`).forEach(card => {
      card.classList.remove('system-builder__product-card--selected');
      card.setAttribute('aria-pressed', 'false');
    });

    this.updateSummary();
  }

  /**
   * Handle quantity change in summary
   */
  handleQuantityChange(variantId, delta) {
    if (!variantId || !this.selectedProducts[variantId]) return;

    const product = this.selectedProducts[variantId];
    const newQuantity = (product.quantity || 1) + delta;

    if (newQuantity <= 0) {
      delete this.selectedProducts[variantId];

      this.querySelectorAll(`[data-product-card][data-variant-id="${variantId}"]`).forEach(card => {
        card.classList.remove('system-builder__product-card--selected');
        card.setAttribute('aria-pressed', 'false');
      });
    } else {
      product.quantity = newQuantity;
    }

    this.updateSummary();
  }

  /**
   * Render a product card HTML string
   */
  renderProductCard(variantData, productType) {
    const imageUrl = variantData.image ? this.getImageUrl(variantData.image, 200) : '';
    const price = this.formatMoney(variantData.price);
    const displayTitle = variantData.productTitle
      ? (variantData.title && variantData.title !== 'Default Title'
          ? `${variantData.productTitle} - ${variantData.title}`
          : variantData.productTitle)
      : variantData.title || 'Product';

    const isSelected = !!this.selectedProducts[variantData.id];
    const isAvailable = variantData.available !== false;
    const outOfStockClass = !isAvailable ? ' system-builder__product-card--out-of-stock' : '';

    return `
      <div class="system-builder__product-card${isSelected ? ' system-builder__product-card--selected' : ''}${outOfStockClass}"
           data-product-card
           data-product-type="${productType}"
           data-variant-id="${variantData.id}"
           data-available="${isAvailable}"
           role="button"
           tabindex="0"
           aria-pressed="${isSelected}"
           aria-label="Click to ${isSelected ? 'remove from' : 'add to'} your system: ${displayTitle}${!isAvailable ? ' (Out of Stock)' : ''}">
        <div class="system-builder__product-select-indicator">
          <span class="system-builder__checkmark"></span>
        </div>
        ${!isAvailable ? '<div class="system-builder__out-of-stock-badge">Out of Stock</div>' : ''}
        <div class="system-builder__product-image">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${displayTitle}" class="system-builder__product-img" loading="lazy">`
            : '<div class="system-builder__product-placeholder-image"></div>'
          }
        </div>
        <div class="system-builder__product-info">
          <h4 class="system-builder__product-title">${displayTitle}</h4>
          <p class="system-builder__product-price">${price}</p>
          ${!isAvailable ? '<p class="system-builder__stock-status">This item is currently out of stock</p>' : ''}
        </div>
        <input type="hidden" name="variant_id" value="${variantData.id}">
      </div>
    `;
  }

  /**
   * Update summary section
   */
  updateSummary() {
    const summary = this.querySelector('[data-summary]');
    if (!summary) return;

    const summaryItemsContainer = summary.querySelector('[data-summary-items]');
    const emptyState = summary.querySelector('[data-summary-empty]');
    const footer = summary.querySelector('[data-summary-footer]');

    const selectedProductCount = Object.keys(this.selectedProducts).length;
    const hasSelectedProducts = selectedProductCount > 0;

    if (emptyState) emptyState.hidden = hasSelectedProducts;
    if (footer) footer.hidden = !hasSelectedProducts;

    if (summaryItemsContainer) {
      summaryItemsContainer.innerHTML = '';

      const productsByType = {
        'harness-model': [],
        'harness-accessory': [],
        'accessory': []
      };

      Object.entries(this.selectedProducts).forEach(([variantId, product]) => {
        if (product && product.productType && productsByType[product.productType]) {
          productsByType[product.productType].push({ variantId, ...product });
        }
      });

      ['harness-model', 'harness-accessory', 'accessory'].forEach(type => {
        productsByType[type].forEach(product => {
          const itemHtml = this.createSummaryItemHtml(product.variantId, product);
          summaryItemsContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
      });
    }

    // Calculate total
    let total = 0;
    let itemCount = 0;

    Object.values(this.selectedProducts).forEach(product => {
      if (product?.price) {
        const qty = product.quantity || 1;
        total += product.price * qty;
        itemCount += qty;
      }
    });

    const totalEl = summary.querySelector('[data-total-price]');
    if (totalEl) totalEl.textContent = this.formatMoney(total);

    const addToCartBtn = summary.querySelector('[data-add-to-cart]');
    if (addToCartBtn) {
      const baseText = addToCartBtn.dataset.originalText || addToCartBtn.textContent;
      if (!addToCartBtn.dataset.originalText) addToCartBtn.dataset.originalText = baseText;
      addToCartBtn.textContent = itemCount > 0
        ? `Add to Cart (${itemCount} item${itemCount > 1 ? 's' : ''})`
        : baseText;
    }
  }

  /**
   * Create summary item HTML
   */
  createSummaryItemHtml(variantId, product) {
    const displayTitle = product.productTitle
      ? (product.title && product.title !== 'Default Title'
          ? `${product.productTitle} - ${product.title}`
          : product.productTitle)
      : product.title || 'Product';

    const imageUrl = product.image ? this.getImageUrl(product.image, 120) : '';
    const quantity = product.quantity || 1;

    return `
      <div class="system-builder__summary-item" data-summary-item="${variantId}">
        <div class="system-builder__summary-item-image">
          ${imageUrl ? `<img src="${imageUrl}" alt="${displayTitle}" loading="lazy">` : ''}
        </div>
        <div class="system-builder__summary-item-details">
          <span class="system-builder__summary-name">${displayTitle}</span>
          <span class="system-builder__summary-price">${this.formatMoney(product.price * quantity)}</span>
        </div>
        <div class="system-builder__summary-quantity">
          <button type="button" class="system-builder__quantity-btn" data-quantity-decrease="${variantId}" aria-label="Decrease quantity">−</button>
          <span class="system-builder__quantity-value" data-quantity-display="${variantId}">${quantity}</span>
          <button type="button" class="system-builder__quantity-btn" data-quantity-increase="${variantId}" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="system-builder__summary-remove" data-summary-remove="${variantId}" aria-label="Remove item">&times;</button>
      </div>
    `;
  }

  /**
   * Clear all selections and reset the UI
   */
  clearAllSelections() {
    this.selectedProducts = {};

    this.querySelectorAll('[data-product-card]').forEach(card => {
      card.classList.remove('system-builder__product-card--selected');
      card.setAttribute('aria-pressed', 'false');
    });

    this.updateSummary();
  }

  /**
   * Handle add to cart
   */
  async handleAddToCart(button) {
    const items = [];

    Object.entries(this.selectedProducts).forEach(([variantId, product]) => {
      if (product?.id) {
        items.push({ id: product.id, quantity: product.quantity || 1 });
      }
    });

    if (items.length === 0) {
      button.textContent = 'Select products first';
      setTimeout(() => {
        button.textContent = button.dataset.originalText || 'Add All to Cart';
      }, 2000);
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.dataset.originalText = originalText;
    button.textContent = 'Adding...';

    try {
      // Collect cart drawer section IDs for section rendering
      const cartItemComponents = document.querySelectorAll('cart-items-component[data-section-id]');
      const sectionIds = [];
      cartItemComponents.forEach(el => {
        if (el.dataset.sectionId) sectionIds.push(el.dataset.sectionId);
      });

      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          items,
          ...(sectionIds.length > 0 ? { sections: sectionIds.join(',') } : {})
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.description || responseData.message || '';
        if (errorMessage.toLowerCase().includes('out of stock') ||
            errorMessage.toLowerCase().includes('not available') ||
            errorMessage.toLowerCase().includes('inventory')) {
          throw new Error('out_of_stock');
        }
        throw new Error(errorMessage || 'Failed to add to cart');
      }

      const cartResponse = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`, {
        headers: { 'Accept': 'application/json' }
      });
      const cart = await cartResponse.json();

      this.updateCartCount(cart.item_count);

      // Dispatch cart:update event — triggers cart drawer to open and cart items to re-render
      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource: cart,
            sourceId: this.id,
            data: {
              source: 'system-builder',
              sections: responseData.sections || {}
            }
          }
        })
      );

      this.clearAllSelections();

      button.textContent = originalText;
      button.disabled = false;

    } catch (error) {
      console.error('System Builder: Error adding to cart', error);

      let errorText = 'Error - Try Again';
      if (error.message === 'out_of_stock') {
        errorText = 'Some items are out of stock';
      } else if (error.message && error.message.length <= 30) {
        errorText = error.message;
      }

      button.textContent = errorText;
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2500);
    }
  }

  /**
   * Update cart count in header
   */
  updateCartCount(count) {
    const selectors = [
      '.cart-count', '.cart-count-bubble', '[data-cart-count]', '.cart__count',
      '.header__cart-count', '#cart-icon-bubble', '.cart-icon__count',
      '.js-cart-count', '[data-cart-item-count]', '.site-header__cart-count'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.tagName !== 'SPAN' || !el.querySelector('span')) {
          el.textContent = count;
        }
        if (count > 0) {
          el.removeAttribute('hidden');
          el.style.display = '';
        }
      });
    });
  }

  /**
   * Format money value
   */
  formatMoney(cents) {
    if (typeof cents !== 'number') return '';
    if (window.Shopify?.formatMoney) return window.Shopify.formatMoney(cents);
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get image URL with size
   */
  getImageUrl(image, size) {
    if (!image) return '';
    if (typeof image === 'string') {
      return image.replace(/(\.[^.]+)$/, `_${size}x$1`);
    }
    if (image.src) {
      return image.src.replace(/(\.[^.]+)$/, `_${size}x$1`);
    }
    return '';
  }
}

customElements.define('system-builder', SystemBuilder);
