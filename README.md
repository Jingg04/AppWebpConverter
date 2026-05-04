# FluxWebP

A fast, client-side WebP converter for JPG, PNG, GIF, BMP, TIFF, HEIC, and HEIF files.

## Run

Open `index.html` in a modern browser. No install step is required.

## Included

- Multi-file drag and drop upload queue
- Browser-native WebP conversion with a quality slider
- Lazy HEIC and TIFF decoding codecs loaded only when those formats are used
- Before/after comparison slider
- Single WebP downloads and ZIP download for bulk conversions
- Local conversion history
- Dark and light mode
- Best-effort JPEG EXIF preservation
- Browser API: `window.FluxWebP.convertFile(file, options)`

## Notes

Animated GIFs are converted through the browser canvas path, so browsers generally export the first frame. For guaranteed animated GIF, HEIC, and TIFF parity in every browser, add a serverless Sharp or Squoosh endpoint behind the same API interface.
