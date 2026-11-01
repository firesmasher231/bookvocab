# App Icons

## Required Icons

For the PWA to work properly, you need to create the following icons:

1. **icon-192.png** - 192x192 pixels (any purpose)
2. **icon-512.png** - 512x512 pixels (any purpose)
3. **icon-maskable-512.png** - 512x512 pixels (maskable - with safe zone)

## How to Generate Icons

### Option 1: Using PWA Asset Generator (Recommended)

```bash
npx @vite-pwa/assets-generator --preset minimal public/icons/icon-base.svg
```

### Option 2: Using Online Tools

1. Visit [https://www.pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
2. Upload a 512x512 PNG or SVG
3. Download the generated icon pack
4. Copy the required icons to this directory

### Option 3: Manual Creation

Create a simple 512x512 image with:
- Background color: #6366f1 (primary color)
- Icon: White book symbol centered
- For maskable icon: Keep important content within 80% safe zone (centered circle)

## Temporary Solution

For development, you can create simple placeholder icons using any image editor:
1. Create a 512x512 square with the app's primary color
2. Add a white book icon in the center
3. Export as PNG
4. Resize to 192x192 for the smaller icon
5. For maskable, ensure content is within a centered circle

The app will still work without proper icons, but they improve the installation experience.
