/**
 * Misc Listeners Module
 * Manages miscellaneous event listeners: name input font-size adjustment and form Enter prevention
 */
export class MiscListeners {

  /**
   * Adjust font-size of name input based on actual text width
   * Features: debounce, caching, ResizeObserver, adaptive steps
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {ActorSheet} sheet - The sheet instance (needed to store ResizeObserver reference)
   */
  static setupNameInputFontSize(element, sheet) {
    const nameInput = element.querySelector('.character-name-input') ||
                     element.querySelector('input[name="name"]');

    if (!nameInput) {
      console.warn('[NAME INPUT] Name input not found in DOM');
      return;
    }

    let lastValue = nameInput.value;
    let lastFontSize = 15;
    let debounceTimer = null;

    const adjustFontSize = () => {
      const currentValue = nameInput.value;

      if (currentValue === lastValue && lastFontSize) {
        return;
      }

      const maxWidth = 95;
      const minFontSize = 10;
      const maxFontSize = 15;
      let fontSize = maxFontSize;

      nameInput.style.setProperty('--name-font-size', `${fontSize}px`);

      while (nameInput.scrollWidth > maxWidth && fontSize > minFontSize) {
        const overflow = nameInput.scrollWidth - maxWidth;
        const step = overflow > 10 ? 1 : 0.5;
        fontSize -= step;
        if (fontSize < minFontSize) fontSize = minFontSize;
        nameInput.style.setProperty('--name-font-size', `${fontSize}px`);
      }

      lastValue = currentValue;
      lastFontSize = fontSize;

      console.log('[NAME INPUT] Width:', nameInput.scrollWidth + 'px', '| Font-size:', fontSize + 'px', '| Cached');
    };

    const debouncedAdjust = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        adjustFontSize();
      }, 50);
    };

    adjustFontSize();
    nameInput.addEventListener('input', debouncedAdjust);
    nameInput.addEventListener('change', adjustFontSize);

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        lastValue = null;
        adjustFontSize();
      });

      resizeObserver.observe(nameInput);

      if (!sheet._nameInputObserver) sheet._nameInputObserver = resizeObserver;
    }

    console.log('[NAME INPUT] Enhanced width-based adjustment enabled (debounce + cache + ResizeObserver)');
  }

  /**
   * Prevent form submission when Enter is pressed on input fields
   * @param {HTMLElement} element - The sheet's HTML element
   */
  static preventEnterSubmit(element) {
    const form = element.querySelector('form');
    if (!form) return;

    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
        event.preventDefault();
        event.stopPropagation();
        event.target.blur();
      }
    });

    console.log('[CARDIGAN] Form Enter key prevention enabled');
  }

}
