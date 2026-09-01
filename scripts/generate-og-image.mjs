import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const mark = await sharp('public/brand/okhana-mark.png')
  .resize(420, 420, {
    fit: 'contain',
    background: { r: 249, g: 247, b: 242, alpha: 1 },
  })
  .png()
  .toBuffer();

const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f9f7f2"/>
      <stop offset="55%" stop-color="#ffe7cb"/>
      <stop offset="100%" stop-color="#f3d2bc"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="720" y="280" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#1a3533" letter-spacing="6">OKHANA</text>
  <text x="720" y="350" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500" fill="#e89b6c" letter-spacing="3">FAMILY. TOGETHER. ALWAYS.</text>
  <text x="720" y="420" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#5c6f6c">AI-powered family hub</text>
</svg>`);

const base = sharp(svg).composite([{ input: mark, left: 120, top: 105 }]);
const webp = await base.clone().webp({ quality: 82, effort: 6 }).toBuffer();
const jpg = await base.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
await writeFile('public/brand/og-default.webp', webp);
await writeFile('public/brand/og-default.jpg', jpg);
console.log(`og webp ${(webp.length / 1024).toFixed(1)} KB, jpg ${(jpg.length / 1024).toFixed(1)} KB`);
