/**
 * Generates every Habibit icon variant from the one hand-made source SVG.
 *
 *   npm run icons
 *
 * `assets/habibit Icon.svg` is the single source of truth and is never written
 * to. Re-export the icon from your design tool, drop it in, re-run this, and
 * every size updates together. The generated PNGs are committed, so a
 * production install (and Vercel's build) never needs sharp.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets', 'habibit Icon.svg');

/** The brand ground. The icon plate, the page and the status bar are all this. */
const PLATE = '#FFFBF7';

const CANVAS = 512;
const CENTRE = CANVAS / 2;

/**
 * Android may crop a maskable icon to a circle of 80% diameter (radius 204.8
 * here). The heart's bounding box is 369x315 centred on (256,256), so its
 * widest corners sit ~211 from centre — just outside that circle. Scaling to
 * 0.82 pulls them in to ~173 and leaves a comfortable margin.
 */
const MASKABLE_SCALE = 0.82;

/**
 * Pulls the artwork apart into the background plate and the heart tiles.
 * The plate is the only rect that spans the full canvas.
 */
function parseSource(svg) {
  const artwork = svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '');
  const rects = artwork.match(/<rect\b[^>]*\/>/g) ?? [];

  const heart = rects.filter((r) => !/\bwidth="512"/.test(r));
  if (heart.length === 0) throw new Error('No heart tiles found in the source SVG.');
  if (heart.length === rects.length) throw new Error('No full-canvas plate rect found.');

  return heart.join('');
}

/**
 * @param heart   the heart tile markup
 * @param rx      plate corner radius. 128 where the image is shown as-is (browser
 *                tab, task switcher); 0 where the platform applies its own mask,
 *                because a rounded square inside a rounded square leaves a sliver.
 * @param scale   heart scale about the centre
 * @param size    rendered px, or null to leave it vector
 */
function buildSvg(heart, { rx, scale, size = null }) {
  const dimensions = size === null ? '' : ` width="${size}" height="${size}"`;
  const open = scale === 1 ? '' : `<g transform="translate(${CENTRE} ${CENTRE}) scale(${scale}) translate(-${CENTRE} -${CENTRE})">`;
  const close = scale === 1 ? '' : '</g>';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}"${dimensions}>` +
    `<rect width="${CANVAS}" height="${CANVAS}" rx="${rx}" fill="${PLATE}"/>` +
    `${open}${heart}${close}` +
    `</svg>`
  );
}

const PNG_TARGETS = [
  // Shown as-is, so it keeps its own rounded plate.
  { out: 'public/icons/icon-192.png', size: 192, rx: 128, scale: 1 },
  { out: 'public/icons/icon-512.png', size: 512, rx: 128, scale: 1 },
  // Android applies its own mask, and may crop to the 80% safe circle.
  { out: 'public/icons/icon-512-maskable.png', size: 512, rx: 0, scale: MASKABLE_SCALE },
  // iOS applies its own squircle mask; ship it full-bleed.
  { out: 'app/apple-icon.png', size: 180, rx: 0, scale: 1 },
];

async function write(relativePath, data) {
  const target = join(ROOT, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  return target;
}

const source = await readFile(SOURCE, 'utf8');
const heart = parseSource(source);

console.log(`source   ${(source.length / 1024).toFixed(1)} KB  ->  heart tiles: ${(heart.match(/<rect/g) ?? []).length}`);

// The browser-tab favicon stays vector: crisp at any DPI, and ~2 KB once the
// source file's C2PA metadata block is stripped.
const faviconSvg = buildSvg(heart, { rx: 128, scale: 1 });
await write('app/icon.svg', faviconSvg);
console.log(`app/icon.svg                         vector   ${(faviconSvg.length / 1024).toFixed(1)} KB`);

for (const { out, size, rx, scale } of PNG_TARGETS) {
  const svg = buildSvg(heart, { rx, scale, size });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

  const { width, height } = await sharp(png).metadata();
  if (width !== size || height !== size) {
    throw new Error(`${out}: expected ${size}x${size}, got ${width}x${height}`);
  }

  await write(out, png);
  console.log(
    `${out.padEnd(36)} ${String(width).padStart(3)}px   ${(png.length / 1024).toFixed(1)} KB` +
      `  rx=${rx} scale=${scale}`,
  );
}

console.log('\nDone. These outputs are committed, so the deploy build does not need sharp.');
