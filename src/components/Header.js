import { createElement, hapticFeedback } from '../utils/helpers.js';
import { appState } from '../js/state.js';
import { createBookSwitcher } from './BookSwitcher.js';

const ICONS = {
  home: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>`,
  library: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
  books: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z"/></svg>`,
};

/**
 * Create the bottom bar: book switcher on the left, navigation on the right.
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createHeader(container) {
  const bar = createElement('div', { className: 'bottom-bar' });
  const inner = createElement('div', { className: 'bottom-bar-inner' });

  inner.appendChild(createBookSwitcher());

  const nav = createElement('nav', {
    className: 'nav-pill glass-pill',
    'aria-label': 'Main',
  });

  const buttons = [
    { view: 'home', label: 'Search' },
    { view: 'library', label: 'Library' },
    { view: 'books', label: 'Books' },
  ];

  buttons.forEach(({ view, label }) => {
    const btn = createElement('button', {
      type: 'button',
      className: 'nav-btn',
      'aria-label': label,
      title: label,
      'data-view': view,
      onClick: () => {
        hapticFeedback('light');
        if (view !== 'books') appState.set('currentBook', null);
        appState.set('currentView', view);
      },
    });
    btn.innerHTML = `${ICONS[view]}<span class="nav-btn-label">${label}</span>`;
    nav.appendChild(btn);
  });

  inner.appendChild(nav);
  bar.appendChild(inner);
  container.appendChild(bar);

  function updateActiveState(view) {
    // The scanner lives under Books
    const tab = view === 'scanner' ? 'books' : view;
    nav.querySelectorAll('.nav-btn').forEach((btn) => {
      const on = btn.dataset.view === tab;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  appState.subscribe('currentView', updateActiveState);
  updateActiveState(appState.get('currentView'));

  return { updateActiveState };
}
