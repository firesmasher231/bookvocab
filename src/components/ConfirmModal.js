import { createElement, hapticFeedback } from '../utils/helpers.js';
import { fadeInUp, fadeOutDown } from '../utils/animations.js';

/**
 * Create a confirmation modal
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @param {Function} options.onConfirm - Callback when confirmed
 * @param {Function} options.onCancel - Callback when cancelled
 * @param {boolean} options.danger - Whether this is a dangerous action
 * @returns {HTMLElement}
 */
export function createConfirmModal(options = {}) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm = () => {},
    onCancel = () => {},
    danger = false,
  } = options;

  // Overlay
  const overlay = createElement('div', {
    style: `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
      animation: fadeIn 0.2s ease;
    `,
    onClick: (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    },
  });

  // Modal card
  const modal = createElement('div', {
    style: `
      max-width: 420px;
      width: 100%;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1.5px solid rgba(255, 255, 255, 0.8);
      border-radius: 1.25rem;
      padding: 2rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
    `,
  });

  // Title
  const titleEl = createElement('h3', {
    style: `
      font-size: 1.375rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #171717;
      margin-bottom: 0.75rem;
    `,
  }, title);
  modal.appendChild(titleEl);

  // Message
  const messageEl = createElement('p', {
    style: `
      font-size: 0.9375rem;
      color: #525252;
      line-height: 1.6;
      letter-spacing: -0.011em;
      margin-bottom: 1.75rem;
      white-space: pre-line;
    `,
  }, message);
  modal.appendChild(messageEl);

  // Buttons
  const buttonsContainer = createElement('div', {
    style: 'display: flex; gap: 0.75rem;',
  });

  const cancelBtn = createElement('button', {
    className: 'btn-secondary',
    style: 'flex: 1;',
    onClick: handleCancel,
  }, cancelText);

  const confirmBtn = createElement('button', {
    className: danger ? 'btn-danger' : 'btn-primary',
    style: 'flex: 1;',
    onClick: handleConfirm,
  }, confirmText);

  buttonsContainer.appendChild(cancelBtn);
  buttonsContainer.appendChild(confirmBtn);
  modal.appendChild(buttonsContainer);

  overlay.appendChild(modal);

  async function handleConfirm() {
    hapticFeedback('medium');
    overlay.style.animation = 'fadeOut 0.2s ease';
    modal.style.animation = 'scaleOut 0.2s ease';
    setTimeout(() => {
      overlay.remove();
      onConfirm();
    }, 200);
  }

  async function handleCancel() {
    hapticFeedback('light');
    overlay.style.animation = 'fadeOut 0.2s ease';
    modal.style.animation = 'scaleOut 0.2s ease';
    setTimeout(() => {
      overlay.remove();
      onCancel();
    }, 200);
  }

  // Show modal with animation
  document.body.appendChild(overlay);
  modal.style.animation = 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

  return overlay;
}

