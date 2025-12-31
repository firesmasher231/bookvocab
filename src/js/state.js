/**
 * Proxy-based reactive state management
 */
class AppState {
  constructor() {
    this._state = {
      currentView: 'home',        // 'home' | 'library' | 'books' | 'scanner'
      currentBook: null,          // Currently selected book for filtering
      words: [],                  // Current word list (filtered or all)
      books: [],                  // All books
      searchQuery: '',            // Search input
      isLoading: false,
      error: null,
      scannerActive: false,
      selectedWord: null,         // Currently selected word for detail view
    };

    this._listeners = new Map();

    // Create reactive proxy
    this.state = new Proxy(this._state, {
      set: (target, property, value) => {
        const oldValue = target[property];
        target[property] = value;

        // Notify listeners
        if (this._listeners.has(property)) {
          this._listeners.get(property).forEach(callback => {
            callback(value, oldValue);
          });
        }

        // Also notify global listeners
        if (this._listeners.has('*')) {
          this._listeners.get('*').forEach(callback => {
            callback(property, value, oldValue);
          });
        }

        return true;
      }
    });
  }

  /**
   * Subscribe to state changes
   * @param {string} property - Property to watch (use '*' for all properties)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(property, callback) {
    if (!this._listeners.has(property)) {
      this._listeners.set(property, new Set());
    }
    this._listeners.get(property).add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get(property).delete(callback);
    };
  }

  /**
   * Get current state value
   * @param {string} property - Property name
   * @returns {any}
   */
  get(property) {
    return this.state[property];
  }

  /**
   * Set state value
   * @param {string} property - Property name
   * @param {any} value - New value
   */
  set(property, value) {
    this.state[property] = value;
  }

  /**
   * Update multiple state properties at once
   * @param {Object} updates - Object with properties to update
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      this.state[key] = updates[key];
    });
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.state.currentView = 'home';
    this.state.currentBook = null;
    this.state.words = [];
    this.state.books = [];
    this.state.searchQuery = '';
    this.state.isLoading = false;
    this.state.error = null;
    this.state.scannerActive = false;
    this.state.selectedWord = null;
  }
}

// Export singleton instance
export const appState = new AppState();
