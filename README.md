# FluxWebP Pro — Professional Universal Image Optimization Platform

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://app-webp-converter.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Server Uploads](https://img.shields.io/badge/Privacy-100%25%20On--Device-success)](https://app-webp-converter.vercel.app/#privacy)
[![Supported Formats](https://img.shields.io/badge/Supported%20Formats-32%2B-orange)](https://app-webp-converter.vercel.app/#formats)

> **Live Application**: [https://app-webp-converter.vercel.app/](https://app-webp-converter.vercel.app/)

**FluxWebP Pro** is an enterprise-grade, client-side image conversion and optimization web platform. Engineered for photographers, design studios, web developers, and privacy-conscious users, it delivers lightning-fast, high-fidelity conversion across 32+ image formats directly inside modern browser runtimes without cloud dependencies, API keys, or server uploads.

---

## 🌟 Key Highlights

- **Universal Input Decoder**: Decodes Camera RAWs (Sony ARW, Canon CR2/CR3, Nikon NEF, Adobe DNG, Fuji RAF, Olympus ORF, Panasonic RW2, Pentax PEF), Adobe Photoshop (PSD, PSB), Scalable Vectors (SVG, SVGZ), Apple High Efficiency (HEIC, HEIF, HIF), Prepress (TIFF), Gaming Textures (TGA), NetPBM (PPM, PGM), and standard web rasters.
- **Multi-Format Output Engine**: Encode to **WebP**, **PNG (Lossless)**, **JPEG**, or **AVIF (Next-Gen)** with configurable compression quality and lossless presets.
- **HandBrake Web Video Transcoder & MP4 / WebM Compressor**:
  - Full client-side video transcoding and compression inspired by HandBrake.
  - **MP4 to MP4 Compressor (1–2GB → Under 100MB Without Visual Quality Loss)**:
    - Smart Bitrate Allocation: automatically calculates exact target bitrates based on duration with safety headroom (e.g. 95MB ceiling for 100MB targets).
    - Perceptual Quality Preservation: maintains crisp 1080p/720p visuals using H.264 video with AAC 128 kbps audio; activates adaptive resolution scaling for longer clips to eliminate macroblocking and double bits-per-pixel fidelity.
    - Quick size target presets: **Under 100MB** (1–2GB reducer), **Under 50MB** (Social/Telegram), **Under 25MB** (Discord Free upload ceiling), **Under 10MB** (Email attachments), or custom target MB.
    - Auto-detection: automatically applies the 1–2GB compressor preset when uploading source video files >= 100MB.
  - **Universal Format Transcoding**: Convert any video (**MP4**, **MOV**, **MKV**, **AVI**, **WebM**, **FLV**, **WMV**, **M4V**) into optimized **MP4** (`.mp4`, H.264/AAC) or **WebM** (`.webm`, VP9/VP8/Opus).
  - 12 HandBrake encoding presets: **1–2GB → Under 100MB MP4**, **Universal HQ 1080p MP4**, **Social 50MB MP4**, **Discord 25MB MP4**, **Web HQ 1080p30 (VP9)**, **Web Fast 720p30**, **Mobile Data Saver 480p**, **Smooth 60 FPS HQ**, **Near-Lossless (CRF 16)**, **Silent Web Loop (Muted)**, and **Audio Only (Opus/AAC Extractor)**.
  - Constant Quality (CRF/RF) rate control (RF 15 to 38), average bitrate modes, and target file size modes.
  - Aspect-ratio preserving dimension scaler (1080p, 720p, 480p, 360p, custom), Contain/Cover fit modes, and 90°/180°/270° rotation.
  - Interactive clip trimming with dual scrub sliders and real-time visual preview.
  - EBML duration patcher: injects exact seekable duration metadata for 100% compliant WebM playback across VLC, QuickTime, and browsers.
  - Synchronized Dual Comparison Player: play source and transcoded videos in lockstep to verify visual fidelity and compression savings.
  - 1-Click synthetic sample video generator for instant testing without uploading files.
- **Zero-Trust On-Device Privacy**: 100% of pixel decoding, resizing, metadata extraction, and re-encoding occurs inside the local browser sandbox via WebAssembly and Canvas 2D. No server logs, no external network transmission.
- **Interactive Dual Comparison Stage**:
  - **Split View Slider**: Pixel-accurate vertical split handle with real-time sliding comparison.
  - **Side-by-Side View**: Simultaneous inspection of decoded original vs. optimized output.
  - **Checkerboard Transparency**: High-contrast alpha channel visualization for PNG, WebP, and SVG assets.
  - **Fullscreen Image Inspector**: 25% to 400% zoom, pan, and real-time EXIF camera/lens pill telemetry.
- **Batch Processing Workspace**:
  - Drag-and-drop batch queue with live thumbnails, format pills, and progress bars.
  - Concurrency management (1 to 4 parallel workers).
  - Queue pause, resume, retry failed items, and drag-and-drop item reordering.
  - Zero-dependency client-side ZIP generator with custom naming rules.
- **Advanced Optimization Controls**:
  - Quality range slider (5–100%) with 6 instant presets (Max Size, High, Balanced 82%, Crisp, Near Lossless, Lossless).
  - **Auto Optimize Mode**: Intelligent heuristic analysis of transparency, dimensions, and source compression to maximize savings without visual degradation.
  - **Smart Resizing**: Aspect-ratio preserving width and height constraints.
  - **EXIF Metadata & Privacy**: Preserves camera exposure/sensor metadata while optionally stripping GPS location tags for privacy.
  - **Output Naming Patterns**: Original name, suffix (`_optimized`), prefix (`flux-`), or custom prefixes.
- **Comprehensive Format Directory**: Searchable, filterable catalog of 32+ supported formats with engine tags and architectural details.
- **Local Conversion History**: Searchable audit log of recent conversions with instant JSON export.
- **Developer JavaScript SDK**: High-performance browser API for integrating on-device conversion into third-party web apps.

---

## 📁 Universal Format Directory (32+ Supported Formats)

| Category | Extensions | Decoding Technology | Key Features |
| :--- | :--- | :--- | :--- |
| **Camera RAW** | `.arw`, `.srf`, `.sr2` (Sony)<br>`.cr2`, `.cr3`, `.crw` (Canon)<br>`.nef`, `.nrw` (Nikon)<br>`.dng` (Adobe / Leica)<br>`.raf` (Fujifilm)<br>`.orf`, `.ori` (Olympus)<br>`.rw2`, `.raw` (Panasonic)<br>`.pef` (Pentax)<br>`.3fr`, `.fff` (Hasselblad)<br>`.srw` (Samsung)<br>`.x3f` (Sigma) | TIFF IFD parser + Strict binary stream scanner | Millisecond camera-calibrated preview extraction; preserves authentic sensor color profiles and EXIF metadata. |
| **Design & Pro** | `.psd`, `.psb` (Adobe Photoshop)<br>`.tif`, `.tiff` (Prepress)<br>`.tga`, `.targa` (Truevision)<br>`.ppm`, `.pgm`, `.pbm`, `.pnm` (NetPBM) | `ag-psd` WebAssembly + `UTIF.js` + Binary RLE stream parser | Renders merged composite rasters, 16-bit TIFF channels, and uncompressed gaming textures without desktop software. |
| **Modern & Vector** | `.svg`, `.svgz` (Scalable Vector)<br>`.heic`, `.heif`, `.hif` (Apple HEVC)<br>`.hdr` (Radiance) | Dynamic Vector Scaler (up to 2400px) + `heic2any` WebAssembly | Vectors dynamically scaled for razor-sharp rasterization; client-side HEVC container unwrapping. |
| **Standard Web** | `.webp`, `.png`, `.jpg`, `.jpeg`, `.jfif`, `.avif`, `.gif`, `.bmp`, `.ico`, `.cur` | Native Canvas 2D Codecs & ImageBitmap | Ultra-fast hardware-accelerated decoding and multi-format encoding. |

---

## 🚀 Quick Start

### Running Locally

FluxWebP Pro has **zero runtime dependencies** and requires **no build step**.

1. Clone the repository:
   ```bash
   git clone https://github.com/Jingg04/AppWebpConverter.git
   cd AppWebpConverter
   ```
2. Open `index.html` in any modern desktop or mobile browser (Chrome, Edge, Firefox, Safari, Arc, Brave):
   ```bash
   # Windows PowerShell
   Start-Process index.html

   # macOS
   open index.html

   # Linux
   xdg-open index.html
   ```

### Deploying to Vercel

The application is pre-configured for static hosting on Vercel:

1. Push your repository to GitHub.
2. Import the repository in your [Vercel Dashboard](https://vercel.com/new).
3. Framework Preset: **Other** (Static HTML).
4. Root Directory: `./`.
5. Deploy. Every push to `main` automatically triggers an updated deployment within seconds.

---

## 💻 Developer JavaScript SDK

Integrate FluxWebP Pro's client-side conversion engine into your own web applications:

```javascript
// Convert any supported image file (Camera RAW, PSD, SVG, PNG, JPG, etc.)
const result = await window.FluxWebP.convertFile(file, {
  format: "webp",           // 'webp' | 'png' | 'jpeg' | 'avif'
  quality: 82,              // 5 - 100
  preserveMetadata: true,   // Preserves camera EXIF from JPEG and RAW
  stripGps: true,           // Strips sensitive geolocation tags for privacy
  resize: {
    maxWidth: 1920,         // Optional: constrain max width
    maxHeight: 1080,        // Optional: constrain max height
    maintainAspect: true    // Preserve aspect ratio
  }
});

console.log(result);
// Schema:
// {
//   blob: Blob,            // Optimized binary image blob
//   width: 1920,           // Final output width
//   height: 1080,          // Final output height
//   originalSize: 14205840,// Input file bytes
//   outputSize: 842100,    // Output file bytes
//   savedBytes: 13363740,  // Exact bytes reduced
//   savedPercent: 94,      // Percentage saved
//   format: "webp"         // Output format
// }
```

---

## 🎨 Design System & Color Tokens

Built strictly according to professional SaaS interface standards with high contrast, consistent 12-16px border radii, accessible focus rings, and custom dark mode:

- **Primary Blue (`#2563EB`)**: Main interactive color, primary actions, and focus rings.
- **Primary Red (`#E53935`)**: Error indicators, failed items, and destructive operations.
- **Optimization Orange (`#F97316`)**: Processing indicators, Camera RAW badges, and optimization highlights.
- **Highlight Yellow (`#FACC15`)**: Warnings, highlights, and status accents.
- **Surface White (`#FFFFFF`)**: Primary card and surface backgrounds in light mode.
- **Background (`#F5F7FA`)**: Clean, spacious workspace background.
- **Dark Text (`#172033`)**: High-contrast typography for maximum readability.
- **Border (`#E2E8F0`)**: Subtle boundaries separating functional zones.

---

## 🔒 Privacy & Security Architecture

1. **Local Processing Only**: Files are processed exclusively inside the browser's memory. No image data is ever uploaded to any third-party server.
2. **Instant Memory Cleanup**: Extracted memory buffers and browser Object URLs are immediately revoked once conversion finishes, eliminating memory leaks even when processing dozens of multi-megabyte files.
3. **Automated GPS Cleansing**: Geolocation coordinates embedded in camera photos are stripped during output creation, protecting personal privacy when sharing photos online.

---

## 📄 License

Open source under the [MIT License](LICENSE). Contributions, bug reports, and format additions are welcome!
