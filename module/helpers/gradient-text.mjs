/**
 * Wrap each word matched by `selector` in its own <span class="gradient-word">.
 * The gradient text-fill (background-clip: text) is normally sized to the whole paragraph's
 * bounding box, so on multi-line text the top line reads lighter and the bottom line darker.
 * Wrapping per word gives each word its own small box, so the gradient reads consistently
 * across the whole paragraph instead of fading top-to-bottom.
 * @param {HTMLElement} wrapper
 * @param {string} selector
 */
export function wrapWordsInGradientSpans(wrapper, selector) {
  const paragraphs = wrapper.querySelectorAll(selector);
  for (const p of paragraphs) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    for (const textNode of textNodes) {
      const fragment = document.createDocumentFragment();
      for (const part of textNode.textContent.split(/(\s+)/)) {
        if (part === '') continue;
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'gradient-word';
          span.textContent = part;
          fragment.appendChild(span);
        }
      }
      textNode.replaceWith(fragment);
    }
  }
}
