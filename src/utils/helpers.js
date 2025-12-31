/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format a timestamp to a readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string}
 */
export function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Create an HTML element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {string|HTMLElement|Array} content - Content (string, element, or array)
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, content = null) {
  const element = document.createElement(tag);

  // Set attributes
  Object.keys(attrs).forEach(key => {
    if (key === 'className') {
      element.className = attrs[key];
    } else if (key === 'dataset') {
      Object.keys(attrs[key]).forEach(dataKey => {
        element.dataset[dataKey] = attrs[key][dataKey];
      });
    } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
      // Event listeners
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, attrs[key]);
    } else {
      element.setAttribute(key, attrs[key]);
    }
  });

  // Add content
  if (content) {
    if (Array.isArray(content)) {
      content.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement) {
          element.appendChild(child);
        }
      });
    } else if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    }
  }

  return element;
}

/**
 * Trigger haptic feedback (vibration) if supported
 * @param {string} type - 'light', 'medium', 'heavy'
 */
export function hapticFeedback(type = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[type] || 10);
  }
}

/**
 * Check if the app is running in standalone mode (PWA installed)
 * @returns {boolean}
 */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'info'
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const toast = createElement('div', {
    className: `toast toast-${type}`,
    role: 'alert',
  }, message);

  // Add toast styles if not exists
  if (!document.getElementById('toast-styles')) {
    const style = createElement('style', { id: 'toast-styles' });
    style.textContent = `
      .toast {
        position: fixed;
        bottom: 6rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: saturate(180%) blur(20px);
        -webkit-backdrop-filter: saturate(180%) blur(20px);
        border: 0.5px solid rgba(0, 0, 0, 0.08);
        color: #171717;
        padding: 0.875rem 1.5rem;
        border-radius: 1rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
        z-index: 1000;
        animation: slideUp 0.2s ease-out;
        max-width: calc(100% - 2rem);
        font-size: 0.8125rem;
        font-weight: 400;
        letter-spacing: -0.01em;
      }
      .toast-success { background: rgba(255, 255, 255, 0.9); }
      .toast-error { background: rgba(255, 255, 255, 0.9); }
      .toast-info { background: rgba(255, 255, 255, 0.9); }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translate(-50%, 1rem);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
