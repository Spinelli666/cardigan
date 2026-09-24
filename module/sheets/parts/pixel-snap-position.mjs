/**
 * Pixel-snapped window positioning.
 *
 * Foundry's ApplicationV2 applies `left`/`top`/`width`/`height` exactly as computed — dragging with
 * a fractional devicePixelRatio (e.g. Windows display scaling at 125%/150%) produces pointer
 * coordinates like 312.8px, and the initial centering `(clientWidth - width) / 2` can land on .5px.
 * At those positions the browser snaps text to whole device pixels but draws images, SVGs,
 * backgrounds and borders at the fractional offset, so they drift ~0.5–1px relative to each other
 * while the window moves — perceived as the sheet text "jittering".
 *
 * Snapping every value to the device pixel grid (multiples of 1 / devicePixelRatio) keeps the whole
 * window aligned to physical pixels, so everything inside rasterizes consistently.
 */

/**
 * Round a CSS pixel value to the nearest whole device pixel.
 * @param {number} value - Value in CSS pixels
 * @param {number} dpr - Device pixel ratio
 * @returns {number} Value in CSS pixels that maps to an integer number of device pixels
 */
function snapToDevicePixel(value, dpr) {
  return Math.round(value * dpr) / dpr;
}

/**
 * Snap a resolved ApplicationV2 position to the device pixel grid.
 * Meant to wrap the result of `super._updatePosition(position)`.
 * @param {ApplicationPosition} position - Resolved position from ApplicationV2#_updatePosition
 * @returns {ApplicationPosition} The same object, with numeric fields snapped
 */
export function snapPositionToDevicePixels(position) {
  const dpr = window.devicePixelRatio || 1;
  for (const key of ['left', 'top', 'width', 'height']) {
    if (typeof position[key] === 'number' && Number.isFinite(position[key])) {
      position[key] = snapToDevicePixel(position[key], dpr);
    }
  }
  return position;
}
