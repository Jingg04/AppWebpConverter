# FluxWebP

A fast, universal, client-side WebP converter supporting all picture file types, including Camera RAW (Sony ARW, Canon CR2/CR3, Nikon NEF, Adobe DNG, Fuji RAF, Olympus ORF, Panasonic RW2, Pentax PEF), Adobe Photoshop PSD, SVG, AVIF, HEIC, TIFF, PNG, and JPG.

## Run

Open `index.html` in any modern web browser. No backend or build step is required — 100% private, on-device conversion.

## Supported Formats

- **Camera RAW**: Sony (`.arw`, `.srf`, `.sr2`), Canon (`.cr2`, `.cr3`, `.crw`), Nikon (`.nef`, `.nrw`), Adobe DNG (`.dng`), Fujifilm (`.raf`), Olympus (`.orf`, `.ori`), Panasonic Lumix (`.rw2`, `.raw`), Pentax (`.pef`), Hasselblad (`.3fr`, `.fff`), Minolta (`.mrw`), Sigma (`.x3f`), Leica (`.rwl`), Samsung (`.srw`)
- **Design & Pro**: Adobe Photoshop (`.psd`, `.psb`), High Efficiency (`.heic`, `.heif`, `.hif`), Tagged Image (`.tif`, `.tiff`), Truevision (`.tga`, `.targa`), Radiance HDR (`.hdr`)
- **Vector & Modern Web**: Scalable Vector Graphics (`.svg`, `.svgz` with automatic high-res scaling), AVIF (`.avif`), WebP (`.webp` recompression)
- **Standard & Legacy**: PNG (`.png`), JPEG (`.jpg`, `.jpeg`, `.jfif`), GIF (`.gif`), Windows Bitmap (`.bmp`, `.dib`), Icons (`.ico`, `.cur`), NetPBM (`.ppm`, `.pgm`, `.pbm`, `.pnm`), QOI (`.qoi`)

## Included Features

- **Universal File Queue**: Drag and drop batches of mixed files (RAW photos, PSDs, SVGs, JPGs).
- **Fast RAW Preview Engine**: Structured TIFF/IFD traversal + stream scanning extracts high-resolution camera previews in milliseconds.
- **Lazy Codec Loading**: External codecs for HEIC (`heic2any`), TIFF (`UTIF.js`), and Photoshop (`ag-psd`) load on-demand only when those formats are uploaded.
- **Before / After Comparison**: Interactive slider comparing the decoded original image against the compressed WebP output.
- **Lossless & Quality Controls**: Compression quality range slider (0–100) with instant batch reconversion.
- **EXIF Preservation**: Camera metadata (camera model, lens, shutter speed, ISO, etc.) is preserved from both JPEG and Camera RAW inputs.
- **Bulk ZIP & Single Downloads**: Download individual WebP files or all converted items as a single ZIP archive.
- **Developer API**: Convert images programmatically via `window.FluxWebP.convertFile(file, options)`.
- **Private & Secure**: All pixels stay in the local browser sandbox.

## Notes

- Animated GIFs are converted through the browser canvas path, exporting the primary frame.
- High-resolution camera RAW files (such as 24MP-60MP ARW files) utilize their embedded full/half-sensor ISP previews for blazing-fast performance and true camera color accuracy.
