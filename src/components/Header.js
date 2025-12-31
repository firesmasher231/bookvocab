import { createElement, hapticFeedback } from '../utils/helpers.js';
import { appState } from '../js/state.js';

/**
 * Create iOS-style floating pill navigation
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createHeader(container) {
  // iOS-style floating pill navbar at bottom
  const nav = createElement('nav', {
    className: 'nav-pill',
    style: `
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: saturate(180%) blur(20px);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      border: 0.5px solid rgba(255, 255, 255, 0.5);
      border-radius: 24px;
      padding: 0.5rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
      display: flex;
      gap: 0.25rem;
    `,
  });

  const buttons = [
    { view: 'home', label: 'Home', icon: '◉' },
    { view: 'library', label: 'Library', icon: '☰' },
    { view: 'books', label: 'Books', icon: '◫' },
  ];

  buttons.forEach(({ view, label, icon }) => {
    const btn = createElement('button', {
      className: 'nav-btn',
      style: `
        padding: 0.625rem 1.25rem;
        border-radius: 18px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: #525252;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        min-height: 44px;
        transition: all 0.2s ease;
        position: relative;
      `,
      'aria-label': label,
      'data-view': view,
      onClick: () => {
        hapticFeedback('light');
        if (view === 'home') {
          appState.set('currentView', 'home');
          appState.set('currentBook', null);
        } else if (view === 'library') {
          appState.set('currentView', 'library');
          appState.set('currentBook', null);
        } else if (view === 'books') {
          appState.set('currentView', 'books');
        }
      },
    });

    const iconSpan = createElement('span', {
      style: 'font-size: 1.125rem;',
    });
    iconSpan.textContent = icon;

    const labelSpan = createElement('span');
    labelSpan.textContent = label;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
    nav.appendChild(btn);
  });

  container.appendChild(nav);

  /**
   * Update active button state - iOS pill style
   */
  function updateActiveState(view) {
    // Remove active state from all buttons
    nav.querySelectorAll('.nav-btn').forEach(btn => {
      btn.style.background = 'transparent';
      btn.style.color = '#525252';
    });

    // Add active state to current view button - filled pill
    const activeBtn = nav.querySelector(`[data-view="${view}"]`);
    if (activeBtn) {
      activeBtn.style.background = 'rgba(0, 0, 0, 0.06)';
      activeBtn.style.color = '#171717';
    }
  }

  // Subscribe to view changes
  appState.subscribe('currentView', (view) => {
    updateActiveState(view);
  });

  // Set initial active state
  updateActiveState(appState.get('currentView'));

  return {
    updateActiveState,
  };
}
