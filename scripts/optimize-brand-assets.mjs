/**
 * Generates favicon + compressed brand/PWA icons from the master logo.
 * Run: node scripts/optimize-brand-assets.mjs
 *
 * Favicons use the circular emblem only (wordmark is illegible at 16–32px).
 * Keeps public/brand/okhana-logo-source.jpg as the uncompressed master.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const brandDir = path.join(root, 'public', 'brand');
const iconsDir = path.join(root, 'public', 'icons');
const publicDir = path.join(root, 'public');
const sourcePath = path.join(root, 'assets', 'brand', 'okhana-logo-source.jpg');
const legacyPublicPath = path.join(brandDir, 'okhana-logo.png');
const legacyPublicJpg = path.join(brandDir, 'okhana-logo.jpg');

const CREAM = { r: 249, g: 247, b: 242, alpha: 1 };

function isBackground(r, g, b, a) {
  if (a < 10) return true;
  return r > 240 && g > 235 && b > 225;
}

async function contentBounds(input, { yMin = 0, yMax = Infinity } = {}) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  const top = Math.max(0, yMin);
  const bottom = Math.min(h - 1, yMax);

  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (isBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX) {
    throw new Error('No non-background pixels found for crop');
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function squarePadClamped(bounds, { padRatio = 0.08, maxBottom }) {
  const side = Math.max(bounds.width, bounds.height);
  const pad = Math.round(side * padRatio);
  let size = side + pad * 2;
  let left = Math.round(bounds.left - (size - bounds.width) / 2);
  let top = Math.round(bounds.top - (size - bounds.height) / 2);

  // Never pull the wordmark into favicons — clamp bottom, grow other sides with cream.
  if (typeof maxBottom === 'number' && top + size > maxBottom) {
    size = maxBottom - top;
    // Re-center horizontally for the new square side if content is narrower.
    left = Math.round(bounds.left - (size - bounds.width) / 2);
    // If height now exceeds available room above maxBottom, pin bottom and shrink.
    if (size < bounds.height) {
      top = Math.max(0, maxBottom - bounds.height);
      size = Math.max(bounds.width, bounds.height);
      left = Math.round(bounds.left - (size - bounds.width) / 2);
      if (top + size > maxBottom) {
        size = maxBottom - top;
      }
    } else {
      top = maxBottom - size;
    }
  }

  return { left, top, width: size, height: size };
}

async function extractOntoCream(input, region) {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  const extractLeft = Math.max(0, region.left);
  const extractTop = Math.max(0, region.top);
  const extractRight = Math.min(w, region.left + region.width);
  const extractBottom = Math.min(h, region.top + region.height);
  const extractWidth = extractRight - extractLeft;
  const extractHeight = extractBottom - extractTop;

  const extracted = await sharp(input)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractWidth,
      height: extractHeight,
    })
    .toBuffer();

  return sharp({
    create: {
      width: region.width,
      height: region.height,
      channels: 3,
      background: CREAM,
    },
  })
    .composite([
      {
        input: extracted,
        left: extractLeft - region.left,
        top: extractTop - region.top,
      },
    ])
    .png()
    .toBuffer();
}

async function writeSizedPng(inputBuf, outPath, size, colors = 128) {
  const buf = await sharp(inputBuf)
    .resize(size, size, { fit: 'cover', position: 'centre', background: CREAM })
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 80,
      effort: 10,
      colors: size <= 64 ? Math.min(colors, 64) : colors,
    })
    .toBuffer();
  await writeFile(outPath, buf);
  return buf.length;
}

async function writeIco(emblemBuf) {
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const png = await sharp(emblemBuf)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, palette: true, colors: 48, effort: 10 })
      .toBuffer();
    images.push({ size, png });
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * images.length;
  const total = offset + images.reduce((sum, img) => sum + img.png.length, 0);
  const ico = Buffer.alloc(total);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(images.length, 4);

  let dirOffset = 6;
  for (const image of images) {
    ico.writeUInt8(image.size >= 256 ? 0 : image.size, dirOffset);
    ico.writeUInt8(image.size >= 256 ? 0 : image.size, dirOffset + 1);
    ico.writeUInt8(0, dirOffset + 2);
    ico.writeUInt8(0, dirOffset + 3);
    ico.writeUInt16LE(1, dirOffset + 4);
    ico.writeUInt16LE(32, dirOffset + 6);
    ico.writeUInt32LE(image.png.length, dirOffset + 8);
    ico.writeUInt32LE(offset, dirOffset + 12);
    image.png.copy(ico, offset);
    offset += image.png.length;
    dirOffset += 16;
  }

  const faviconPath = path.join(publicDir, 'favicon.ico');
  await writeFile(faviconPath, ico);
  return ico.length;
}

async function ensureSource() {
  await mkdir(path.dirname(sourcePath), { recursive: true });
  try {
    await sharp(sourcePath).metadata();
    return sourcePath;
  } catch {
    // Bootstrap from a previously copied public asset if the master is missing.
    for (const candidate of [legacyPublicJpg, legacyPublicPath]) {
      try {
        await sharp(candidate).metadata();
        await copyFile(candidate, sourcePath);
        return sourcePath;
      } catch {
        // try next
      }
    }
    throw new Error(`Missing master logo at ${sourcePath}`);
  }
}

async function main() {
  await mkdir(brandDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });

  const masterPath = await ensureSource();
  const sourceBuf = await sharp(masterPath).rotate().toBuffer();

  // Stop above OKHANA wordmark (text starts ~y=630 on the 1024 master).
  const emblemMaxBottom = 605;
  const emblemBounds = await contentBounds(sourceBuf, { yMin: 150, yMax: emblemMaxBottom });
  const emblemSquare = squarePadClamped(emblemBounds, {
    padRatio: 0.06,
    maxBottom: emblemMaxBottom,
  });
  const emblemBuf = await extractOntoCream(sourceBuf, emblemSquare);

  const fullBounds = await contentBounds(sourceBuf);
  const meta = await sharp(sourceBuf).metadata();
  const fullRegion = {
    left: Math.max(0, fullBounds.left - 24),
    top: Math.max(0, fullBounds.top - 24),
    width: Math.min((meta.width ?? 0) - Math.max(0, fullBounds.left - 24), fullBounds.width + 48),
    height: Math.min((meta.height ?? 0) - Math.max(0, fullBounds.top - 24), fullBounds.height + 48),
  };
  const fullBuf = await sharp(sourceBuf).extract(fullRegion).png().toBuffer();

  const report = [];

  // Full logo — JPEG + WebP (avoid heavy PNG for photographic mark).
  {
    const jpeg = await sharp(fullBuf)
      .resize(640, 640, { fit: 'contain', background: CREAM })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    await writeFile(path.join(brandDir, 'okhana-logo.jpg'), jpeg);
    report.push(['brand/okhana-logo.jpg', jpeg.length]);

    const webp = await sharp(fullBuf)
      .resize(640, 640, { fit: 'contain', background: CREAM })
      .webp({ quality: 78, effort: 6 })
      .toBuffer();
    await writeFile(path.join(brandDir, 'okhana-logo.webp'), webp);
    report.push(['brand/okhana-logo.webp', webp.length]);
  }

  // Circular mark — avatar / small UI.
  {
    const png = await sharp(emblemBuf)
      .resize(192, 192, { fit: 'cover' })
      .png({ compressionLevel: 9, palette: true, colors: 96, effort: 10 })
      .toBuffer();
    await writeFile(path.join(brandDir, 'okhana-mark.png'), png);
    report.push(['brand/okhana-mark.png', png.length]);

    const webp = await sharp(emblemBuf)
      .resize(192, 192, { fit: 'cover' })
      .webp({ quality: 78, effort: 6 })
      .toBuffer();
    await writeFile(path.join(brandDir, 'okhana-mark.webp'), webp);
    report.push(['brand/okhana-mark.webp', webp.length]);
  }

  // Wordmark strip.
  {
    const wordBounds = await contentBounds(sourceBuf, { yMin: 610, yMax: 860 });
    const padded = {
      left: Math.max(0, wordBounds.left - 12),
      top: Math.max(0, wordBounds.top - 8),
      width: wordBounds.width + 24,
      height: wordBounds.height + 16,
    };
    padded.width = Math.min(padded.width, (meta.width ?? 0) - padded.left);
    padded.height = Math.min(padded.height, (meta.height ?? 0) - padded.top);
    const wordPng = await sharp(sourceBuf)
      .extract(padded)
      .resize({ width: 320, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, colors: 48, effort: 10 })
      .toBuffer();
    await writeFile(path.join(brandDir, 'okhana-wordmark.png'), wordPng);
    report.push(['brand/okhana-wordmark.png', wordPng.length]);
  }

  for (const [name, size, colors] of [
    ['favicon-16.png', 16, 48],
    ['favicon-32.png', 32, 64],
    ['icon-180.png', 180, 96],
    ['icon-192.png', 192, 96],
    ['icon-512.png', 512, 128],
  ]) {
    const bytes = await writeSizedPng(emblemBuf, path.join(iconsDir, name), size, colors);
    report.push([`icons/${name}`, bytes]);
  }

  // Maskable with ~20% safe zone.
  {
    const inner = Math.round(512 * 0.7);
    const maskable = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 249, g: 247, b: 242 },
      },
    })
      .composite([
        {
          input: await sharp(emblemBuf).resize(inner, inner, { fit: 'cover' }).png().toBuffer(),
          gravity: 'centre',
        },
      ])
      .png({ compressionLevel: 9, palette: true, colors: 96, effort: 10 })
      .toBuffer();
    await writeFile(path.join(iconsDir, 'icon-maskable-512.png'), maskable);
    report.push(['icons/icon-maskable-512.png', maskable.length]);
  }

  report.push(['favicon.ico', await writeIco(emblemBuf)]);
  report.push([
    'favicon-32x32.png',
    await writeSizedPng(emblemBuf, path.join(publicDir, 'favicon-32x32.png'), 32, 64),
  ]);
  report.push([
    'apple-touch-icon.png',
    await writeSizedPng(emblemBuf, path.join(publicDir, 'apple-touch-icon.png'), 180, 96),
  ]);

  const total = report.reduce((sum, [, n]) => sum + n, 0);
  console.log('Optimized brand assets:');
  for (const [name, n] of report) {
    console.log(`  ${name.padEnd(36)} ${(n / 1024).toFixed(1)} KB`);
  }
  console.log(`  ${'total'.padEnd(36)} ${(total / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
