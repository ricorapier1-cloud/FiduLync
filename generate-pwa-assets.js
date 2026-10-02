const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Premium FiduLync Brand SVG (Emerald Green + Cyber Navy)
const fidulyncLogoSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0B1120"/>
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Cyber Shield Base -->
  <path d="M512 120 L800 240 V500 C800 720 512 880 512 880 C512 880 224 720 224 500 V240 L512 120 Z" fill="url(#grad)" opacity="0.15" stroke="url(#grad)" stroke-width="24"/>
  <!-- Unbreakable Chain Link / Infinity Motif -->
  <path d="M420 512 A 92 92 0 1 0 512 420" fill="none" stroke="url(#grad)" stroke-width="64" stroke-linecap="round"/>
  <path d="M604 512 A 92 92 0 1 0 512 604" fill="none" stroke="url(#grad)" stroke-width="64" stroke-linecap="round"/>
  <circle cx="512" cy="512" r="140" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-dasharray="24 24" />
</svg>`;

async function generate() {
  const logoBuffer = Buffer.from(fidulyncLogoSvg);

  // Generate perfect App Icons
  await sharp(logoBuffer).resize(192, 192).toFile(path.join(publicDir, 'icon-192x192.png'));
  await sharp(logoBuffer).resize(512, 512).toFile(path.join(publicDir, 'icon-512x512.png'));
  await sharp(logoBuffer).resize(192, 192).toFile(path.join(publicDir, 'maskable-icon.png'));
  
  // Generate exact 1920x1080 Desktop Screenshot
  await sharp({ create: { width: 1920, height: 1080, channels: 4, background: '#0B1120' } })
    .composite([{ input: await sharp(logoBuffer).resize(400, 400).toBuffer(), gravity: 'center' }])
    .png().toFile(path.join(publicDir, 'screenshot-desktop.png'));

  // Generate exact 720x1280 Mobile Screenshot
  await sharp({ create: { width: 720, height: 1280, channels: 4, background: '#0B1120' } })
    .composite([{ input: await sharp(logoBuffer).resize(300, 300).toBuffer(), gravity: 'center' }])
    .png().toFile(path.join(publicDir, 'screenshot-mobile.png'));

  console.log('✅ All PWA pixel-perfect assets generated successfully.');
}
generate();
