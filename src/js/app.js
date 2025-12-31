import { initDB, getAllWords, getAllBooks } from '../services/db.js';
import { appState } from './state.js';
import { createHeader } from '../components/Header.js';
import { createWordInputSimple } from '../components/WordInputSimple.js';
import { createSimpleWordList } from '../components/SimpleWordList.js';
import { createWordList } from '../components/WordList.js';
import { createBookCard } from '../components/BookCard.js';
import { createBarcodeScanner } from '../components/BarcodeScanner.js';
import { createElement, showToast } from '../utils/helpers.js';
import { fadeInUp, pageTransition, staggerChildren } from '../utils/animations.js';

let wordInputComponent = null;
let wordListComponent = null;
let barcodeScanner = null;

/**
 * Initialize the application
 */
export async function initApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  try {
    // Initialize database
    await initDB();

    // Create main container
    const container = createElement('div', {
      className: 'app-container flex flex-col min-h-screen',
    });

    // Create header
    createHeader(container);

    // Create main content area (with padding for bottom nav)
    const main = createElement('main', {
      id: 'main-content',
      className: 'flex-1 container-app',
      style: 'padding-top: 2rem; padding-bottom: 7rem;',
    });

    container.appendChild(main);
    app.appendChild(container);

    // Initialize views
    renderView(appState.get('currentView'));

    // Subscribe to view changes
    appState.subscribe('currentView', (view) => {
      renderView(view);
    });

    console.log('App initialized successfully');

  } catch (error) {
    console.error('App initialization failed:', error);
    app.innerHTML = `
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-error mb-4">Failed to Initialize App</h1>
          <p class="text-gray-600 mb-4">${error.message}</p>
          <button onclick="location.reload()" class="btn-primary">Reload</button>
        </div>
      </div>
    `;
  }
}

/**
 * Render different views based on state
 */
async function renderView(view) {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Fade out current content
  if (main.children.length > 0) {
    await pageTransition.out(main);
  }

  main.innerHTML = '';

  // Render view
  switch (view) {
    case 'home':
      await renderHomeView(main);
      break;
    case 'library':
      await renderLibraryView(main);
      break;
    case 'books':
      await renderBooksView(main);
      break;
    case 'scanner':
      await renderScannerView(main);
      break;
    default:
      await renderHomeView(main);
  }

  // Fade in new content
  pageTransition.in(main);
}

/**
 * Render home view (simplified word search + elegant listing)
 */
async function renderHomeView(container) {
  // Word search section (centered, minimal)
  const searchSection = createElement('div', {
    className: 'mb-12 text-center',
  });

  container.appendChild(searchSection);

  // Initialize simplified word input component
  wordInputComponent = createWordInputSimple(searchSection);

  // Recent words section (elegant listing)
  const recentSection = createElement('div', {
    id: 'recent-words',
    className: 'mt-12',
  });

  const recentTitle = createElement('h2', {
    className: 'text-subhead mb-6',
    style: `
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      color: #a3a3a3;
      text-transform: uppercase;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    `,
  }, 'Recent');

  recentSection.appendChild(recentTitle);

  // Simple word list container
  const listContainer = createElement('div', {
    id: 'home-word-list',
  });
  recentSection.appendChild(listContainer);

  container.appendChild(recentSection);

  // Create simple word list
  const simpleWordList = createSimpleWordList(listContainer, 10);

  // Global function for refreshing word list
  window.refreshWordList = () => {
    simpleWordList.render();
  };
}

/**
 * Render library view (all words)
 */
async function renderLibraryView(container) {
  const header = createElement('div', {
    className: 'mb-6',
  });

  const titleRow = createElement('div', {
    className: 'flex justify-between items-center mb-4',
  });

  const title = createElement('h2', {
    className: 'text-2xl font-semibold text-gray-900',
  }, 'My Library');
  titleRow.appendChild(title);

  // Clear all button
  const clearBtn = createElement('button', {
    className: 'btn-danger',
    style: 'padding: 0.625rem 1rem; min-height: auto; font-size: 0.875rem;',
    onClick: async () => {
      const { createConfirmModal } = await import('../components/ConfirmModal.js');
      const { clearAllData } = await import('../services/db.js');
      
      createConfirmModal({
        title: 'Clear All Data',
        message: 'Are you sure you want to delete ALL words and books? This action cannot be undone.',
        confirmText: 'Delete Everything',
        cancelText: 'Cancel',
        danger: true,
        onConfirm: async () => {
          try {
            await clearAllData();
            showToast('All data cleared', 'success');
            // Refresh the view
            if (window.refreshWordList) window.refreshWordList();
            if (window.refreshBooksList) window.refreshBooksList();
          } catch (error) {
            console.error('Failed to clear data:', error);
            showToast('Failed to clear data', 'error');
          }
        },
      });
    },
  }, 'Clear All');
  titleRow.appendChild(clearBtn);

  header.appendChild(titleRow);

  // Filter by book dropdown
  const books = await getAllBooks();
  if (books.length > 0) {
    const filterContainer = createElement('div', {
      className: 'flex items-center gap-2',
    });

    const label = createElement('label', {
      className: 'text-sm font-medium text-gray-700',
    }, 'Filter by book:');
    filterContainer.appendChild(label);

    const select = createElement('select', {
      className: 'input-field flex-1',
    });

    const allOption = createElement('option', { value: '' }, 'All books');
    select.appendChild(allOption);

    books.forEach(book => {
      const option = createElement('option', {
        value: book.id,
      }, `${book.title} (${book.wordCount || 0})`);
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      const bookId = e.target.value || null;
      appState.set('currentBook', bookId);
    });

    filterContainer.appendChild(select);
    header.appendChild(filterContainer);
  }

  container.appendChild(header);

  // Word list
  const listContainer = createElement('div', {
    id: 'library-word-list',
  });
  container.appendChild(listContainer);

  wordListComponent = createWordList(listContainer);

  // Global function for refreshing
  window.refreshWordList = () => {
    if (wordListComponent) {
      wordListComponent.render();
    }
  };
}

/**
 * Render books view (all books + scanner button)
 */
async function renderBooksView(container) {
  const header = createElement('div', {
    className: 'flex justify-between items-center mb-6',
  });

  const title = createElement('h2', {
    className: 'text-2xl font-semibold text-gray-900',
  }, 'My Books');
  header.appendChild(title);

  const scanBtn = createElement('button', {
    className: 'btn-primary',
    onClick: () => {
      if (!barcodeScanner) {
        barcodeScanner = createBarcodeScanner(container);
      }
      barcodeScanner.show();
    },
  });
  scanBtn.innerHTML = `
    <span class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
      <span>Scan Barcode</span>
    </span>
  `;
  header.appendChild(scanBtn);

  container.appendChild(header);

  // Books list
  const booksContainer = createElement('div', {
    id: 'books-list',
  });
  container.appendChild(booksContainer);

  await renderBooksList(booksContainer);

  // Global function for refreshing
  window.refreshBooksList = () => {
    renderBooksList(booksContainer);
  };
}

/**
 * Render books list
 */
async function renderBooksList(container) {
  container.innerHTML = '';

  const books = await getAllBooks();

  if (books.length === 0) {
    const emptyState = createElement('div', {
      className: 'text-center py-12',
    });

    const icon = createElement('div', {
      className: 'text-gray-300 mb-4',
    });
    icon.innerHTML = `
      <svg class="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    `;
    emptyState.appendChild(icon);

    const message = createElement('p', {
      className: 'text-gray-500 text-lg mb-2',
    }, 'No books added yet');
    emptyState.appendChild(message);

    const hint = createElement('p', {
      className: 'text-gray-400 text-sm',
    }, 'Scan a barcode to add your first book');
    emptyState.appendChild(hint);

    container.appendChild(emptyState);
    return;
  }

  // Render book cards
  books.forEach(book => {
    const card = createBookCard(book, {
      onClick: (bookData) => {
        // Navigate to library filtered by this book
        appState.set('currentBook', bookData.id);
        appState.set('currentView', 'library');
      },
      onDelete: () => {
        renderBooksList(container);
      },
    });
    container.appendChild(card);
  });

  setTimeout(() => {
    staggerChildren('#books-list', '.book-card');
  }, 10);
}

/**
 * Render scanner view
 */
async function renderScannerView(container) {
  if (!barcodeScanner) {
    barcodeScanner = createBarcodeScanner(container);
  }
  barcodeScanner.show();
}
