const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = __dirname;
const publicDir = path.join(root, 'public');
const appDir = path.join(root, 'app');
const logoPath = path.join(publicDir, 'logo.svg');

const desktopScreenshot = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#080a0f"/>
  <circle cx="1050" cy="80" r="340" fill="#10b981" opacity=".06"/>
  <g font-family="Arial, sans-serif">
    <path d="M75 48 94 56v12c0 12-8 19-19 24-11-5-19-12-19-24V56l19-8Z" fill="none" stroke="#10b981" stroke-width="3"/>
    <path d="M69 75v-8m6 8V60m6 15v-9" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
    <text x="112" y="70" fill="#e2e8f0" font-size="21" font-weight="700">MACROLYNC</text>
    <text x="263" y="70" fill="#10b981" font-size="16">/</text>
    <text x="280" y="70" fill="#e2e8f0" font-size="21" font-weight="700">ALGOLYNC</text>
    <text x="75" y="149" fill="#10b981" font-size="12" letter-spacing="3">INSTITUTIONAL FX RESEARCH</text>
    <text x="75" y="202" fill="#f1f5f9" font-size="42" font-weight="700">Read the regime.</text>
    <text x="75" y="250" fill="#cbd5e1" font-size="42" font-weight="700">Position with context.</text>
    <text x="75" y="286" fill="#94a3b8" font-size="16">Policy divergence, positioning pressure and event risk across G10 FX.</text>
    <rect x="75" y="338" width="340" height="116" rx="12" fill="#0c1016" stroke="#26313d"/>
    <rect x="435" y="338" width="340" height="116" rx="12" fill="#0c1016" stroke="#26313d"/>
    <rect x="795" y="338" width="410" height="116" rx="12" fill="#0c1016" stroke="#26313d"/>
    <text x="98" y="374" fill="#64748b" font-size="11" letter-spacing="2">POLICY RANGE</text>
    <text x="98" y="420" fill="#e2e8f0" font-family="monospace" font-size="30">3.75%</text>
    <text x="458" y="374" fill="#64748b" font-size="11" letter-spacing="2">PAIR BIAS</text>
    <text x="458" y="420" fill="#10b981" font-family="monospace" font-size="30">EUR / USD</text>
    <text x="818" y="374" fill="#64748b" font-size="11" letter-spacing="2">NEXT CATALYST</text>
    <text x="818" y="420" fill="#e2e8f0" font-family="monospace" font-size="26">EVENT RISK</text>
    <rect x="75" y="482" width="1130" height="174" rx="12" fill="#0c1016" stroke="#26313d"/>
    <text x="100" y="518" fill="#94a3b8" font-size="12" letter-spacing="2">MACRO POSITIONING / MARKET STRUCTURE</text>
    <path d="M112 610 230 584 328 600 442 548 548 565 654 526 758 542 868 506 978 529 1090 485 1168 499" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M112 610 230 584 328 600 442 548 548 565 654 526 758 542 868 506 978 529 1090 485 1168 499v116H112Z" fill="#10b981" opacity=".08"/>
    <text x="75" y="690" fill="#64748b" font-size="11" letter-spacing="2">RESEARCH TOOLING / NOT FINANCIAL ADVICE</text>
  </g>
</svg>`;

const mobileScreenshot = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <rect width="720" height="1280" fill="#080a0f"/>
  <circle cx="610" cy="90" r="260" fill="#10b981" opacity=".06"/>
  <g font-family="Arial, sans-serif">
    <path d="M88 64 112 74v15c0 15-10 24-24 30-14-6-24-15-24-30V74l24-10Z" fill="none" stroke="#10b981" stroke-width="4"/>
    <path d="M80 99v-10m8 10V80m8 19v-12" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
    <text x="132" y="92" fill="#e2e8f0" font-size="23" font-weight="700">MACROLYNC</text>
    <text x="134" y="119" fill="#10b981" font-size="11" letter-spacing="2">ALGOLYNC SYSTEMS</text>
    <text x="54" y="210" fill="#10b981" font-size="12" letter-spacing="3">GLOBAL FX RESEARCH</text>
    <text x="54" y="272" fill="#f1f5f9" font-size="40" font-weight="700">Read the regime.</text>
    <text x="54" y="322" fill="#cbd5e1" font-size="34" font-weight="700">Position with context.</text>
    <text x="54" y="366" fill="#94a3b8" font-size="17">Policy, positioning and event risk</text>
    <text x="54" y="392" fill="#94a3b8" font-size="17">across G10 FX markets.</text>
    <rect x="54" y="448" width="612" height="164" rx="14" fill="#0c1016" stroke="#26313d"/>
    <text x="82" y="489" fill="#64748b" font-size="12" letter-spacing="2">POLICY RANGE / G10</text>
    <text x="82" y="551" fill="#e2e8f0" font-family="monospace" font-size="38">3.75%</text>
    <text x="82" y="584" fill="#94a3b8" font-size="14">Highest to lowest available policy rate</text>
    <rect x="54" y="636" width="612" height="164" rx="14" fill="#0c1016" stroke="#26313d"/>
    <text x="82" y="677" fill="#64748b" font-size="12" letter-spacing="2">PAIR BIAS / EURUSD</text>
    <path d="M90 740h540" stroke="#26313d" stroke-width="5" stroke-linecap="round"/>
    <path d="M336 740h166" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>
    <circle cx="502" cy="740" r="11" fill="#10b981"/>
    <text x="82" y="780" fill="#10b981" font-family="monospace" font-size="17">MODEL CONTEXT / NOT A TRADE SIGNAL</text>
    <rect x="54" y="824" width="612" height="244" rx="14" fill="#0c1016" stroke="#26313d"/>
    <text x="82" y="868" fill="#64748b" font-size="12" letter-spacing="2">POSITIONING / EVENT RISK</text>
    <path d="M90 1004 180 968 268 982 358 922 444 942 532 894 622 910" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="54" y="1144" fill="#64748b" font-size="12" letter-spacing="2">ALGOLYNC / LIVE EA TELEMETRY</text>
    <text x="54" y="1180" fill="#94a3b8" font-size="15">MT5 signal and fleet monitoring bridge</text>
    <text x="54" y="1236" fill="#64748b" font-size="11" letter-spacing="2">RESEARCH TOOLING / NOT FINANCIAL ADVICE</text>
  </g>
</svg>`;

function createIco(pngBuffer) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, pngBuffer]);
}

async function writePng(source, filePath, size) {
  await sharp(source).resize(size, size, { fit: 'contain', background: '#080a0f' }).png().toFile(filePath);
}

async function generate() {
  await fs.mkdir(appDir, { recursive: true });
  const logo = await fs.readFile(logoPath);
  await Promise.all([
    writePng(logo, path.join(publicDir, 'logo.png'), 512),
    writePng(logo, path.join(publicDir, 'icon-192.png'), 192),
    writePng(logo, path.join(publicDir, 'icon-512.png'), 512),
    writePng(logo, path.join(publicDir, 'icon-1024.png'), 1024),
    writePng(logo, path.join(publicDir, 'icon-192x192.png'), 192),
    writePng(logo, path.join(publicDir, 'icon-512x512.png'), 512),
    writePng(logo, path.join(publicDir, 'maskable-icon.png'), 192),
    writePng(logo, path.join(publicDir, 'apple-icon.png'), 180),
    sharp(Buffer.from(desktopScreenshot)).png().toFile(path.join(publicDir, 'screenshot-desktop.png')),
    sharp(Buffer.from(mobileScreenshot)).png().toFile(path.join(publicDir, 'screenshot-mobile.png')),
  ]);
  const faviconPng = await sharp(logo).resize(32, 32).png().toBuffer();
  const faviconIco = createIco(faviconPng);
  await Promise.all([
    fs.writeFile(path.join(appDir, 'favicon.ico'), faviconIco),
    fs.writeFile(path.join(publicDir, 'favicon.ico'), faviconIco),
  ]);
}

generate().catch((error) => {
  console.error('Unable to generate MacroLync and AlgoLync assets:', error);
  process.exitCode = 1;
});
