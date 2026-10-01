const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPngBuffer(width, height) {
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;
      if (x > width * 0.35 && x < width * 0.65 && y > height * 0.35 && y < height * 0.65) {
        rawData[idx] = 16;
        rawData[idx + 1] = 185;
        rawData[idx + 2] = 129;
      } else {
        rawData[idx] = 15;
        rawData[idx + 1] = 23;
        rawData[idx + 2] = 42;
      }
    }
  }
  const compressedData = zlib.deflateSync(rawData);
  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return ~c >>> 0;
  }
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressedData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Generate icons & store screenshots
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPngBuffer(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPngBuffer(512, 512));
fs.writeFileSync(path.join(publicDir, 'icon-1024.png'), createPngBuffer(1024, 1024));
fs.writeFileSync(path.join(publicDir, 'screenshot-desktop.png'), createPngBuffer(1280, 720));
fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), createPngBuffer(720, 1280));

// Generate manifest.json
const manifest = {
  name: "FiduLync",
  short_name: "FiduLync",
  description: "P2P Escrow Protection and AlgoLync Quant Suite",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: "#0f172a",
  theme_color: "#0f172a",
  lang: "en",
  dir: "ltr",
  categories: ["finance", "utilities", "business"],
  display_override: ["standalone", "browser"],
  handle_links: "preferred",
  launch_handler: { client_mode: ["navigate-existing", "auto"] },
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    { src: "/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" }
  ],
  screenshots: [
    { src: "/screenshot-desktop.png", sizes: "1280x720", type: "image/png", form_factor: "wide" },
    { src: "/screenshot-mobile.png", sizes: "720x1280", type: "image/png", form_factor: "narrow" }
  ],
  shortcuts: [{ name: "Create Escrow", short_name: "Escrow", url: "/api/escrow/create" }]
};
fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Generate Service Worker
const swCode = `const CACHE_NAME = "fidulync-pwa-v1";
const ASSETS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});`;
fs.writeFileSync(path.join(publicDir, 'sw.js'), swCode);

// Register SW in app/layout.tsx
const layoutPath = path.join(process.cwd(), 'app', 'layout.tsx');
if (fs.existsSync(layoutPath)) {
  let layout = fs.readFileSync(layoutPath, 'utf8');
  const swScript = `<script dangerouslySetInnerHTML={{ __html: \`if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js'); }); }\` }} />`;
  if (!layout.includes('navigator.serviceWorker.register')) {
    layout = layout.replace('</body>', `${swScript}\n</body>`);
    fs.writeFileSync(layoutPath, layout);
  }
}

console.log("✅ PWA SETUP COMPLETE!");