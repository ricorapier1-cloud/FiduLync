const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

const fidulyncSvgLogo = `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="800" rx="160" fill="#0B1120"/>
  <defs>
    <linearGradient id="fidugrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M400 120 L620 220 V420 C620 580 400 700 400 700 C400 700 180 580 180 420 V220 L400 120 Z" fill="none" stroke="url(#fidugrad)" stroke-width="28"/>
  <rect x="320" y="380" width="160" height="130" rx="20" fill="url(#fidugrad)"/>
  <path d="M350 380 V320 C350 290 370 270 400 270 C430 270 450 290 450 320 V380" fill="none" stroke="url(#fidugrad)" stroke-width="24" stroke-linecap="round"/>
  <circle cx="400" cy="435" r="18" fill="#0B1120"/>
  <path d="M400 450 V480" stroke="#0B1120" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const desktopScreenshotSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#0B1120"/>
  <circle cx="640" cy="360" r="400" fill="#10B981" opacity="0.05" />
  <text x="640" y="340" fill="#10B981" font-family="system-ui, sans-serif" font-weight="900" font-size="70" text-anchor="middle">FiduLync Secure Escrow</text>
  <text x="640" y="420" fill="#9CA3AF" font-family="system-ui, sans-serif" font-size="32" text-anchor="middle">Zero Risk Social Commerce for Nigeria</text>
</svg>`;

const mobileScreenshotSvg = `
<svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="1280" fill="#0B1120"/>
  <circle cx="360" cy="640" r="300" fill="#06B6D4" opacity="0.05" />
  <text x="360" y="600" fill="#10B981" font-family="system-ui, sans-serif" font-weight="900" font-size="60" text-anchor="middle">FiduLync</text>
  <text x="360" y="680" fill="#9CA3AF" font-family="system-ui, sans-serif" font-size="28" text-anchor="middle">Mobile Escrow Payments</text>
</svg>`;

async function fixPWA() {
  const logoBuf = Buffer.from(fidulyncSvgLogo);
  const deskBuf = Buffer.from(desktopScreenshotSvg);
  const mobBuf = Buffer.from(mobileScreenshotSvg);

  // 1. Generate strictly sized icons
  await sharp(logoBuf).resize(192, 192).toFile(path.join(publicDir, 'icon-192x192.png'));
  await sharp(logoBuf).resize(512, 512).toFile(path.join(publicDir, 'icon-512x512.png'));
  
  // 2. Generate exact dimension screenshots
  await sharp(deskBuf).resize(1280, 720).toFile(path.join(publicDir, 'screenshot-desktop.png'));
  await sharp(mobBuf).resize(720, 1280).toFile(path.join(publicDir, 'screenshot-mobile.png'));

  console.log('✅ Exact dimension PWA Images generated successfully!');
}

fixPWA();
