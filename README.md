# BookVocab - Vocabulary Tracker PWA

A sleek, minimalist Progressive Web App for tracking vocabulary words from your reading. Look up word definitions, associate them with books, and build your personal vocabulary library.

## Features

- **Word Lookup**: Search for words and get definitions from Merriam-Webster Dictionary API
- **Save to Library**: Store words with definitions, phonetics, and audio pronunciation
- **Book Association**: Link words to books you're reading
- **Barcode Scanning**: Scan book ISBNs to automatically fetch book metadata and covers
- **Filter by Book**: View all words from a specific book
- **PWA**: Install on mobile devices, works offline
- **Mobile-First**: Optimized for mobile viewing and touch interactions
- **Light Minimalist Design**: Clean, distraction-free interface

## Tech Stack

- **Build Tool**: Vite
- **Language**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS 4.x
- **Animations**: Motion (Framer Motion's vanilla JS library)
- **Storage**: IndexedDB (via idb library)
- **Barcode Scanning**: Quagga2
- **APIs**:
  - Merriam-Webster Dictionary API (word definitions)
  - Open Library API (book metadata and covers)

## Prerequisites

- Node.js 20.19+ or 22.12+ (though it may work on 22.11.0 with warnings)
- A Merriam-Webster Dictionary API key (free)

## Setup

1. **Clone the repository** (or you're already here!)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Get a Merriam-Webster API Key**:
   - Visit https://dictionaryapi.com/
   - Register for a free account
   - Request a "Collegiate Dictionary" API key
   - Copy your API key

4. **Configure API key**:
   - Open the app, tap the ⚙ button in the bottom bar, paste your key and
     press Save. The key is stored only in your browser (localStorage) and is
     never committed or built into the site.
   - Optional for local development: create a `.env` file (gitignored) with
     `VITE_MW_API_KEY=your-key` to use it as a fallback when no key is saved.
     Don't set this variable in CI, or the key will be baked into the
     public build.

5. **Generate App Icons** (required for PWA):
   - Open `generate-icons.html` in your browser
   - Click "Download All Icons"
   - Move the downloaded PNG files to `public/icons/` directory
   - Alternatively, use an online PWA icon generator

## Development

Start the development server:

```bash
npm run dev
```

The app will open at http://localhost:3000

## Building for Production

Build the app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The built files will be in the `dist/` directory.

## Deployment

### Option 1: Netlify

1. Connect your repository to Netlify
2. Set build command: `BASE_PATH=/ npm run build`
3. Set publish directory: `dist`
4. Add environment variable: `VITE_MW_API_KEY` with your API key
5. Deploy!

### Option 2: Vercel

1. Connect your repository to Vercel
2. Framework preset: Vite
3. Deploy! (Add your dictionary key in the app's ⚙ Settings. Don't set
   `VITE_MW_API_KEY` on a public host, or it gets baked into the bundle.)

### Option 3: GitHub Pages (current setup)

Pushes to `main` are built and published automatically by
`.github/workflows/static.yml`. In the repository settings, **Pages > Build and
deployment > Source** must be set to **GitHub Actions**.

The site is served from the custom domain <https://bookvocab.adityajoshi.cc/>
(set under **Pages > Custom domain**), so `vite.config.js` builds with
`base: '/'`. If the custom domain is ever removed, the site moves to
`https://firesmasher231.github.io/bookvocab/` and needs
`BASE_PATH=/bookvocab/` in the workflow's build step.

**Note**: For PWA features to work, you must deploy to HTTPS.

## Usage

### Looking Up Words

1. Type a word in the search box on the home screen
2. View the definition, pronunciation, and examples
3. Optionally associate it with a book
4. Click "Save to Library"

### Adding Books

#### Method 1: Barcode Scanning
1. Go to "Books" tab
2. Click "Scan Barcode"
3. Allow camera access
4. Point camera at the book's ISBN barcode
5. Book metadata will be fetched automatically

#### Method 2: Manual Entry
- Currently, books can only be added via barcode scanning
- You can manually enter book data by modifying the database using browser DevTools

### Viewing Your Library

- **Home**: See your 5 most recent words
- **Library**: View all saved words
- **Books**: View all your books and their word counts
- Filter library by specific book using the dropdown

### Offline Usage

Once installed as a PWA, the app works offline for:
- Viewing saved words and books
- Searching through your library

Note: Looking up new words requires an internet connection.

## Project Structure

```
bookvocab/
├── public/
│   ├── icons/              # PWA icons
│   └── sw.js               # Service worker
├── src/
│   ├── components/         # UI components
│   │   ├── WordCard.js
│   │   ├── WordInput.js
│   │   ├── WordList.js
│   │   ├── BookCard.js
│   │   ├── BarcodeScanner.js
│   │   └── Header.js
│   ├── js/
│   │   ├── app.js          # Main app logic
│   │   ├── state.js        # State management
│   │   └── router.js       # (Future: routing)
│   ├── services/
│   │   ├── db.js           # IndexedDB operations
│   │   ├── dictionary.js   # MW API
│   │   ├── books.js        # Open Library API
│   │   └── scanner.js      # Barcode scanning
│   ├── styles/
│   │   └── main.css        # Tailwind + custom styles
│   ├── utils/
│   │   ├── animations.js   # Animation utilities
│   │   └── helpers.js      # Helper functions
│   └── main.js             # Entry point
├── index.html
├── manifest.webmanifest    # PWA manifest
├── vite.config.js
├── .env                    # Environment variables
└── package.json
```

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 14.3+)
- **Camera scanning**: Requires HTTPS on production

## Known Issues

- Service worker requires HTTPS to work in production
- Camera access requires user permission
- Some books may not have covers in Open Library database

## Future Enhancements

- [ ] Dark mode toggle
- [ ] Spaced repetition for vocabulary review
- [ ] Export/import vocabulary data
- [ ] Cloud sync across devices
- [ ] Manual book entry form
- [ ] Page number tracking
- [ ] Word collections/categories
- [ ] Social sharing
- [ ] Voice pronunciation recording

## License

MIT License - feel free to use this project for your own vocabulary tracking needs!

## Credits

- Dictionary data: [Merriam-Webster Dictionary API](https://dictionaryapi.com/)
- Book data: [Open Library API](https://openlibrary.org/)
- Barcode scanning: [Quagga2](https://github.com/ericblade/quagga2)
- Icons: [Heroicons](https://heroicons.com/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
