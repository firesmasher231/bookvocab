import { createElement, hapticFeedback, showToast } from '../utils/helpers.js';
import { initScanner, stopScanner, isCameraAvailable, requestCameraPermission } from '../services/scanner.js';
import { fetchBookByISBN } from '../services/books.js';
import { addBook } from '../services/db.js';
import { fadeInUp, fadeOutDown } from '../utils/animations.js';
import { appState } from '../js/state.js';

/**
 * Create barcode scanner component
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Component interface
 */
export function createBarcodeScanner(container) {
  let scannerActive = false;
  let lastScannedISBN = null;
  let scanTimeout = null;

  const component = createElement('div', {
    className: 'barcode-scanner-container',
    id: 'barcode-scanner',
  });

  /**
   * Show scanner
   */
  async function show() {
    component.innerHTML = '';

    // On iOS Safari, enumerateDevices requires permission first
    // So we skip the availability check and go straight to requesting permission
    // The getUserMedia call will fail if there's no camera
    
    // Request permission (this also checks availability on iOS)
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      showCameraPermissionError();
      return;
    }

    // Create scanner UI
    const scannerCard = createElement('div', {
      className: 'card relative overflow-hidden',
    });

    // Header
    const header = createElement('div', {
      className: 'flex justify-between items-center mb-4',
    });

    const title = createElement('h3', {
      className: 'text-lg font-semibold text-gray-900',
    }, 'Scan Book Barcode');
    header.appendChild(title);

    const closeBtn = createElement('button', {
      className: 'p-2 text-gray-600 hover:text-gray-900 transition-colors',
      'aria-label': 'Close scanner',
      onClick: () => {
        hapticFeedback('light');
        // Stop camera immediately when dismissed
        if (scannerActive) {
          stopScanner();
          scannerActive = false;
          appState.set('scannerActive', false);
        }
        hide();
      },
    });
    closeBtn.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
    header.appendChild(closeBtn);

    scannerCard.appendChild(header);

    // Video container
    const videoContainer = createElement('div', {
      id: 'scanner-video-container',
      className: 'relative bg-black rounded-lg overflow-hidden mb-4',
      style: 'aspect-ratio: 4/3;',
    });

    // Overlay guide
    const overlay = createElement('div', {
      className: 'absolute inset-0 flex items-center justify-center pointer-events-none',
    });
    overlay.innerHTML = `
      <div class="border-4 border-primary rounded-lg" style="width: 80%; height: 40%; opacity: 0.7;"></div>
    `;
    videoContainer.appendChild(overlay);

    scannerCard.appendChild(videoContainer);

    // Instructions
    const instructions = createElement('p', {
      className: 'text-sm text-gray-600 text-center mb-4',
    }, 'Position the barcode within the frame');
    scannerCard.appendChild(instructions);

    // Manual entry section
    const manualEntry = createElement('div', {
      className: 'mb-4',
      style: 'border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 1rem; margin-top: 1rem;',
    });

    const manualLabel = createElement('p', {
      className: 'text-sm text-gray-600 text-center mb-2',
    }, 'Or enter ISBN manually:');
    manualEntry.appendChild(manualLabel);

    const manualInputWrapper = createElement('div', {
      style: 'display: flex; gap: 0.5rem; align-items: center;',
    });

    const isbnInput = createElement('input', {
      type: 'text',
      placeholder: '978-0-123456-78-9',
      className: 'input-field',
      style: 'flex: 1; text-align: center; font-size: 0.9375rem;',
    });

    const submitBtn = createElement('button', {
      className: 'btn-primary',
      style: 'padding: 0.875rem 1.5rem;',
      onClick: async () => {
        const isbn = isbnInput.value.trim().replace(/[-\s]/g, '');
        if (isbn.length >= 10) {
          hapticFeedback('medium');
          await handleManualISBN(isbn);
        } else {
          showToast('Please enter a valid ISBN');
        }
      },
    }, 'Add Book');

    manualInputWrapper.appendChild(isbnInput);
    manualInputWrapper.appendChild(submitBtn);
    manualEntry.appendChild(manualInputWrapper);
    scannerCard.appendChild(manualEntry);

    // Status
    const status = createElement('div', {
      id: 'scanner-status',
      className: 'text-center text-sm',
    });
    status.innerHTML = '<span class="text-gray-500">Initializing camera...</span>';
    scannerCard.appendChild(status);

    component.appendChild(scannerCard);
    container.appendChild(component);

    fadeInUp(scannerCard);

    // Initialize scanner
    try {
      await initScanner(
        videoContainer,
        handleBarcodeDetected,
        handleScannerError
      );

      scannerActive = true;
      status.innerHTML = '<span class="text-success">Ready to scan</span>';
      appState.set('scannerActive', true);

    } catch (error) {
      handleScannerError(error);
    }
  }

  /**
   * Hide scanner
   */
  async function hide() {
    if (scannerActive) {
      stopScanner();
      scannerActive = false;
      appState.set('scannerActive', false);
    }

    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }

    const scannerCard = component.querySelector('.card');
    if (scannerCard) {
      await fadeOutDown(scannerCard);
    }

    component.innerHTML = '';
  }

  /**
   * Handle manual ISBN entry
   */
  async function handleManualISBN(isbn) {
    const status = document.getElementById('scanner-status');
    if (status) {
      status.innerHTML = '<span class="text-primary">Fetching book info...</span>';
    }

    try {
      // Fetch book metadata
      const bookData = await fetchBookByISBN(isbn);

      if (!bookData) {
        status.innerHTML = '<span class="text-error">Book not found. Please check the ISBN.</span>';
        showToast('Book not found');
        return;
      }

      // Add book to database
      const savedBook = await addBook(bookData);

      showToast(`Added: ${savedBook.title}`);
      status.innerHTML = `<span class="text-success">Added: ${savedBook.title}</span>`;

      // Stop camera immediately
      if (scannerActive) {
        stopScanner();
        scannerActive = false;
        appState.set('scannerActive', false);
      }

      // Close scanner after 1.5 seconds
      setTimeout(() => {
        hide();
        // Refresh books view if active
        if (appState.get('currentView') === 'books') {
          if (window.refreshBooksList) window.refreshBooksList();
        }
      }, 1500);

    } catch (error) {
      console.error('Failed to fetch/save book:', error);
      status.innerHTML = '<span class="text-error">Failed to fetch book info. Try again.</span>';
      showToast('Failed to fetch book info');
    }
  }

  /**
   * Handle barcode detection
   */
  async function handleBarcodeDetected(result) {
    const { isbn } = result;

    // Prevent duplicate scans
    if (isbn === lastScannedISBN) {
      return;
    }

    lastScannedISBN = isbn;
    hapticFeedback('heavy');

    const status = document.getElementById('scanner-status');
    if (status) {
      status.innerHTML = '<span class="text-primary">Barcode detected! Fetching book info...</span>';
    }

    try {
      // Fetch book metadata
      const bookData = await fetchBookByISBN(isbn);

      if (!bookData) {
        status.innerHTML = '<span class="text-error">Book not found. Try another barcode.</span>';
        resetScanTimeout();
        return;
      }

      // Add book to database
      const savedBook = await addBook(bookData);

      showToast(`Added: ${savedBook.title}`);
      status.innerHTML = `<span class="text-success">Added: ${savedBook.title}</span>`;

      // Stop camera immediately
      if (scannerActive) {
        stopScanner();
        scannerActive = false;
        appState.set('scannerActive', false);
      }

      // Close scanner after 1.5 seconds
      setTimeout(() => {
        hide();
        // Refresh books view if active
        if (appState.get('currentView') === 'books') {
          if (window.refreshBooksList) window.refreshBooksList();
        }
      }, 1500);

    } catch (error) {
      console.error('Failed to fetch/save book:', error);
      status.innerHTML = '<span class="text-error">Failed to fetch book info. Try again.</span>';
      resetScanTimeout();
    }
  }

  /**
   * Reset scan timeout to allow rescanning
   */
  function resetScanTimeout() {
    if (scanTimeout) clearTimeout(scanTimeout);

    scanTimeout = setTimeout(() => {
      lastScannedISBN = null;
      const status = document.getElementById('scanner-status');
      if (status) {
        status.innerHTML = '<span class="text-success">Ready to scan</span>';
      }
    }, 3000);
  }

  /**
   * Handle scanner errors
   */
  function handleScannerError(error) {
    console.error('Scanner error:', error);

    const status = document.getElementById('scanner-status');
    if (status) {
      status.innerHTML = `<span class="text-error">${error.message}</span>`;
    }

    showToast(error.message, 'error');
  }

  /**
   * Show camera permission error UI
   */
  function showCameraPermissionError() {
    component.innerHTML = '';

    const errorCard = createElement('div', {
      className: 'card text-center',
    });

    const icon = createElement('div', {
      className: 'text-error mb-4',
    });
    icon.innerHTML = `
      <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    `;
    errorCard.appendChild(icon);

    const title = createElement('h3', {
      className: 'text-lg font-semibold text-gray-900 mb-2',
    }, 'Camera Access Required');
    errorCard.appendChild(title);

    const message = createElement('p', {
      className: 'text-gray-600 mb-4',
      style: 'line-height: 1.6;',
    });
    
    // Provide iOS-specific instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
    if (!isHTTPS) {
      message.innerHTML = `
        <strong>HTTPS Required:</strong><br>
        Camera access requires a secure connection (HTTPS).<br>
        The app will only work on localhost or HTTPS domains.
      `;
    } else if (isIOS) {
      message.innerHTML = `
        <strong>On iOS Safari:</strong><br>
        1. Tap the camera icon when prompted<br>
        2. Or go to Settings → Safari → Camera<br>
        3. Select "Ask" or "Allow"<br>
        4. Reload this page and try again
      `;
    } else {
      message.textContent = 'Please allow camera access when prompted, or check your browser settings. You may need to reload the page after granting permission.';
    }
    errorCard.appendChild(message);

    const closeBtn = createElement('button', {
      className: 'btn-primary',
      onClick: () => {
        component.innerHTML = '';
      },
    }, 'Close');
    errorCard.appendChild(closeBtn);

    component.appendChild(errorCard);
    container.appendChild(component);
    fadeInUp(errorCard);
  }

  return {
    show,
    hide,
    isActive: () => scannerActive,
  };
}
