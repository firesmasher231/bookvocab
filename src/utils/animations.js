import { animate, stagger } from 'motion';

/**
 * Fade in and slide up animation
 * @param {HTMLElement|string} element - Element or selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function fadeInUp(element, options = {}) {
  return animate(
    element,
    { opacity: [0, 1], y: [20, 0] },
    { duration: 0.4, easing: 'ease-out', ...options }
  );
}

/**
 * Fade out and slide down animation
 * @param {HTMLElement|string} element - Element or selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function fadeOutDown(element, options = {}) {
  return animate(
    element,
    { opacity: [1, 0], y: [0, 20] },
    { duration: 0.3, easing: 'ease-in', ...options }
  );
}

/**
 * Slide in from direction
 * @param {HTMLElement|string} element - Element or selector
 * @param {string} direction - 'left', 'right', 'up', 'down'
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function slideIn(element, direction = 'left', options = {}) {
  const transforms = {
    left: { x: [-100, 0] },
    right: { x: [100, 0] },
    up: { y: [-100, 0] },
    down: { y: [100, 0] },
  };

  return animate(
    element,
    { opacity: [0, 1], ...transforms[direction] },
    { duration: 0.3, easing: 'ease-out', ...options }
  );
}

/**
 * Slide out in direction
 * @param {HTMLElement|string} element - Element or selector
 * @param {string} direction - 'left', 'right', 'up', 'down'
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function slideOut(element, direction = 'right', options = {}) {
  const transforms = {
    left: { x: [0, -100] },
    right: { x: [0, 100] },
    up: { y: [0, -100] },
    down: { y: [0, 100] },
  };

  return animate(
    element,
    { opacity: [1, 0], ...transforms[direction] },
    { duration: 0.3, easing: 'ease-in', ...options }
  );
}

/**
 * Stagger animation for multiple children
 * @param {string} parentSelector - Parent element selector
 * @param {string} childSelector - Child elements selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function staggerChildren(parentSelector, childSelector, options = {}) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return Promise.resolve();

  const children = parent.querySelectorAll(childSelector);
  if (children.length === 0) return Promise.resolve();

  return animate(
    children,
    { opacity: [0, 1], y: [20, 0] },
    {
      delay: stagger(0.05),
      duration: 0.3,
      easing: 'ease-out',
      ...options,
    }
  );
}

/**
 * Scale animation (for buttons, etc.)
 * @param {HTMLElement|string} element - Element or selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function scaleIn(element, options = {}) {
  return animate(
    element,
    { opacity: [0, 1], scale: [0.9, 1] },
    { duration: 0.2, easing: 'ease-out', ...options }
  );
}

/**
 * Pulse animation
 * @param {HTMLElement|string} element - Element or selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function pulse(element, options = {}) {
  return animate(
    element,
    { scale: [1, 1.05, 1] },
    { duration: 0.3, easing: 'ease-in-out', ...options }
  );
}

/**
 * Shake animation (for errors)
 * @param {HTMLElement|string} element - Element or selector
 * @param {Object} options - Animation options
 * @returns {Promise}
 */
export function shake(element, options = {}) {
  return animate(
    element,
    { x: [0, -10, 10, -10, 10, 0] },
    { duration: 0.4, easing: 'ease-in-out', ...options }
  );
}

/**
 * Page transition helpers
 */
export const pageTransition = {
  /**
   * Fade out current page
   * @param {HTMLElement|string} element - Element or selector
   * @returns {Promise}
   */
  out: (element) => {
    return animate(
      element,
      { opacity: [1, 0] },
      { duration: 0.15, easing: 'ease-in' }
    );
  },

  /**
   * Fade in new page
   * @param {HTMLElement|string} element - Element or selector
   * @returns {Promise}
   */
  in: (element) => {
    return animate(
      element,
      { opacity: [0, 1] },
      { duration: 0.3, easing: 'ease-out' }
    );
  },
};

/**
 * Loading spinner animation
 * @param {HTMLElement|string} element - Element or selector
 * @returns {Object} - Control object with stop method
 */
export function spinnerAnimation(element) {
  const animation = animate(
    element,
    { rotate: [0, 360] },
    { duration: 1, easing: 'linear', repeat: Infinity }
  );

  return {
    stop: () => animation.stop(),
  };
}
