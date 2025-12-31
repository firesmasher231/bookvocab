# Storage System

## How Data is Stored

### Local Storage (IndexedDB)
All data is stored **locally** in your browser using IndexedDB:

- **Words**: Stored with definitions, phonetics, audio URLs, and book associations
- **Books**: Stored with title, author, ISBN, cover URL, and word count
- **Settings**: User preferences

### Images (Book Covers)
Book cover images are **NOT stored locally**. Instead:

1. **Cover URLs** are stored (pointing to Open Library CDN)
2. Images are **cached** by the browser and service worker
3. Service worker provides offline access to previously loaded images
4. If a cover URL points to a 1x1 placeholder, a styled gradient placeholder is shown instead

**Why not store images locally?**
- Saves storage space (images can be several KB each)
- Faster initial load (just store URLs)
- Service worker caching provides offline access
- Automatic updates if covers change on Open Library

## Data Management

### Clear All Data
- Button in Library view (top right)
- Deletes ALL words, books, and settings
- Requires confirmation modal
- Cannot be undone

### Delete Individual Words
- Click delete icon on any word card
- Removes word from database
- Updates associated book's word count

### Delete Books
- Click delete icon on book card
- Shows confirmation modal
- **Deletes all words associated with that book**
- Requires confirmation to prevent accidental deletion

## Offline Support

The app works offline thanks to:

1. **Service Worker**: Caches app files and API responses
2. **IndexedDB**: All data stored locally
3. **Image Caching**: Previously loaded covers are cached

## Data Persistence

- Data persists across browser sessions
- Data is NOT synced across devices
- Clearing browser data will delete everything
- Export/import functionality can be added if needed

## Storage Limits

IndexedDB has generous limits:
- Chrome: ~60% of available disk space
- Firefox: ~50% of available disk space
- Safari: ~1GB

For typical usage (thousands of words), you'll never hit these limits.

