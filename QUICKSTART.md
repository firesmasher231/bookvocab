# Quick Start Guide

Get BookVocab running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Add Your API Key

1. Get a free API key from https://dictionaryapi.com/ (Collegiate Dictionary)
2. Open `.env` file
3. Replace `your-api-key-here` with your actual key

## 3. Generate App Icons

1. Open `generate-icons.html` in your browser
2. Click "Download All Icons"
3. Save the 3 PNG files to `public/icons/` folder

## 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and start tracking vocabulary!

## First Steps

1. **Search for a word** - Try typing "serendipity" in the search box
2. **Save it** - Click "Save to Library" after viewing the definition
3. **Add a book** - Go to Books tab and try scanning a book barcode (or just browse the empty library for now)
4. **View your library** - Check the Library tab to see your saved word

## Tips

- The app works best on mobile devices
- For barcode scanning to work, you need to allow camera access
- All data is stored locally on your device (no account needed!)
- Install as PWA on your phone for the best experience

## Troubleshooting

**App won't start?**
- Make sure you ran `npm install`
- Check that Node.js version is 20.19+ or 22.12+

**Word lookup not working?**
- Verify your API key is correct in `.env`
- Check your internet connection
- Ensure the API key is for "Collegiate Dictionary"

**Icons missing?**
- Generate them using `generate-icons.html`
- Or create 192x192 and 512x512 PNG files manually
- App will work without icons, but they're needed for PWA installation

**Camera not working?**
- Make sure you're on HTTPS (or localhost)
- Grant camera permissions when prompted
- Try a different browser if issues persist

Enjoy tracking your vocabulary!
