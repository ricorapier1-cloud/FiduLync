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
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <path d="M400 120 L620 220 V420 C620 580 400 700 400 700 C400 700 180 580 180 420 V220 L400 120 Z" fill="none" stroke="url(#fidugrad)" stroke-width="28" filter="url(#glow)"/>
  <rect x="320" y="380" width="160" height="130" rx="20" fill="url(#fidugrad)"/>
  <path d="M350 380 V320 C350 290 370 270 400 270 C430 270 450 290 450 320 V380" fill="none" stroke="url(#fidugrad)" stroke-width="24" stroke-linecap="round"/>
  <circle cx="400" cy="435" r="18" fill="#0B1120"/>
  <path d="M400 450 V480" stroke="#0B1120" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const brandBannerSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0B1120"/>
  <defs>
    <linearGradient id="bgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="1000" cy="100" r="300" fill="#10B981" opacity="0.05" />
  <circle cx="200" cy="500" r="250" fill="#06B6D4" opacity="0.05" />
  <g transform="translate(100, 165)">
    <path d="M120 40 L200 80 V150 C200 210 120 250 120 250 C120 250 40 210 40 150 V80 L120 40 Z" fill="none" stroke="url(#bgrad)" stroke-width="12"/>
    <text x="240" y="120" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="800" font-size="72">FiduLync</text>
    <text x="240" y="170" fill="#10B981" font-family="system-ui, sans-serif" font-weight="600" font-size="28" letter-spacing="4">SAFE ESCROW INFRASTRUCTURE</text>
    <text x="240" y="230" fill="#9CA3AF" font-family="system-ui, sans-serif" font-weight="400" font-size="22">Zero Risk Social Commerce for Nigeria &amp; Global Trade</text>
  </g>
</svg>`;

async function buildAssets() {
  const logoBuf = Buffer.from(fidulyncSvgLogo);
  const bannerBuf = Buffer.from(brandBannerSvg);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), fidulyncSvgLogo);
  await sharp(logoBuf).resize(512, 512).toFile(path.join(publicDir, 'logo.png'));
  await sharp(logoBuf).resize(64, 64).toFile(path.join(publicDir, 'favicon.ico'));
  await sharp(bannerBuf).resize(1200, 630).toFile(path.join(publicDir, 'opengraph-image.png'));
}
buildAssets();
