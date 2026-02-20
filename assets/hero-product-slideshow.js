(function () {
  function getCurrencySymbolFromDocument() {
    const el = document.querySelector('[data-hpc-price], .price, .product-price');
    if (!el) return '$';
    const txt = el.textContent.trim();
    const m = txt.match(/[^0-9\s.,-]+/);
    return m ? m[0] : '$';
  }

  function moneyFromCents(cents, symbol) {
    const amount = (cents / 100).toFixed(2);
    return `${symbol || '$'}${amount}`;
  }

  function initSlider(root) {
    const track = root.querySelector('[data-hps-track]');
    const slides = Array.from(root.querySelectorAll('[data-hps-slide]'));
    const prev = root.querySelector('[data-hps-prev]');
    const next = root.querySelector('[data-hps-next]');
    const currentEl = root.querySelector('[data-hps-current]');
    const totalEl = root.querySelector('[data-hps-total]');
    const progressEl = root.querySelector('[data-hps-progress]');

    if (!track || slides.length === 0) return;

    let index = 0;
    const total = slides.length;

    if (totalEl) totalEl.textContent = String(total);

    function updateUI() {
      track.style.transform = `translateX(${-index * 100}%)`;

      if (currentEl) currentEl.textContent = String(index + 1);

      if (progressEl) {
        const pct = (index + 1) / total;
        progressEl.style.width = `${pct * 100}%`;
      }
    }

    function goTo(i) {
      index = (i + total) % total;
      updateUI();
    }

    prev && prev.addEventListener('click', () => goTo(index - 1));
    next && next.addEventListener('click', () => goTo(index + 1));

    // touch swipe
    let startX = null;
    track.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
    track.addEventListener(
      'touchend',
      (e) => {
        if (startX == null) return;
        const endX = e.changedTouches[0].clientX;
        const dx = endX - startX;
        startX = null;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) goTo(index + 1);
        else goTo(index - 1);
      },
      { passive: true }
    );

    updateUI();

    // init mini cards (swatches)
    initCards(root);
  }

  function initCards(root) {
    const symbol = getCurrencySymbolFromDocument();

    root.querySelectorAll('[data-hpc]').forEach((card) => {
      const variantsRaw = card.getAttribute('data-variants');
      if (!variantsRaw) return;

      let variants;
      try {
        variants = JSON.parse(variantsRaw);
      } catch (e) {
        return;
      }

      const link = card.querySelector('[data-hpc-link]') || card.querySelector('.hpc__link');
      const priceEl = card.querySelector('[data-hpc-price]');
      const colorEl = card.querySelector('[data-hpc-color]');
      const imgEl = card.querySelector('.hpc__thumb-img');
      const swatches = Array.from(card.querySelectorAll('[data-hpc-swatch]'));

      function setActiveSwatch(val) {
        swatches.forEach((b) => b.classList.toggle('is-active', b.dataset.swatchValue === val));
      }

      function findVariantByColorValue(colorValue) {
        // Best-effort: pick first variant where options include colorValue
        return variants.find((v) => (v.options || []).includes(colorValue)) || variants[0];
      }

      function updateToVariant(variant, colorValue) {
        if (!variant) return;

        if (link && variant.url) link.setAttribute('href', variant.url);

        if (colorEl && colorValue) colorEl.textContent = colorValue;

        // price
        if (priceEl && typeof variant.price === 'number') {
          const compareAt = variant.compare_at_price;
          const html =
            compareAt && compareAt > variant.price
              ? `<span class="hpc__price-sale">${moneyFromCents(variant.price, symbol)}</span>
                 <span class="hpc__price-compare">${moneyFromCents(compareAt, symbol)}</span>`
              : `<span class="hpc__price-regular">${moneyFromCents(variant.price, symbol)}</span>`;
          priceEl.innerHTML = html;
        }

        // image (variant image support varies by theme json)
        if (imgEl) {
          const imgSrc =
            (variant.featured_image && (variant.featured_image.src || variant.featured_image)) ||
            (variant.image && (variant.image.src || variant.image)) ||
            null;

          if (imgSrc && typeof imgSrc === 'string') {
            imgEl.setAttribute('src', imgSrc);
            imgEl.setAttribute('srcset', '');
          }
        }
      }

      swatches.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault(); // keep click from triggering the <a>
          e.stopPropagation();

          const val = btn.dataset.swatchValue;
          const variant = findVariantByColorValue(val);
          setActiveSwatch(val);
          updateToVariant(variant, val);
        });
      });

      // Radio-input swatches rendered by variant-swatches.liquid
      const swatchesContainer = card.querySelector('.hpc__swatches');
      if (swatchesContainer) {
        /** @param {Event} ev */
        function onSwatchClick(ev) {
          ev.stopPropagation();
        }

        /** @param {Event} ev */
        function onSwatchChange(ev) {
          const target = ev.target;
          if (!(target instanceof HTMLInputElement) || target.type !== 'radio') return;
          const val = target.value;
          const variant = findVariantByColorValue(val);
          updateToVariant(variant, val);
        }

        // Stop clicks from bubbling up to the parent <a> and triggering navigation
        swatchesContainer.addEventListener('click', onSwatchClick);
        // Event delegation: handle change on any radio within the swatches container
        swatchesContainer.addEventListener('change', onSwatchChange);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hps]').forEach(initSlider);
  });
})();
