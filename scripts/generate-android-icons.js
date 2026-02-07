/**
 * Generates Android mipmap launcher foreground icons from public/snapmap-icon.png.
 * Scales the graphic to ~70% and centers it so the home screen mask doesn't clip top/bottom.
 * Run: node scripts/generate-android-icons.js
 * Requires: npm install sharp --save-dev
 */
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Icon uses this fraction of the canvas so launcher mask doesn't clip (Android safe zone ~66%). */
const SAFE_SCALE = 0.7;

const sizes = [
  { density: 'mipmap-mdpi', size: 48 },
  { density: 'mipmap-hdpi', size: 72 },
  { density: 'mipmap-xhdpi', size: 96 },
  { density: 'mipmap-xxhdpi', size: 144 },
  { density: 'mipmap-xxxhdpi', size: 192 },
];

const pngPath = join(root, 'public', 'snapmap-icon.png');
const svgPath = join(root, 'public', 'snapmap-icon.svg');
const sourcePath = existsSync(pngPath) ? pngPath : existsSync(svgPath) ? svgPath : null;

if (!sourcePath) {
  console.error('No public/snapmap-icon.png or snapmap-icon.svg found.');
  process.exit(1);
}

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Run: npm install sharp --save-dev');
    process.exit(1);
  }

  const outDir = join(root, 'android', 'app', 'src', 'main', 'res');

  for (const { density, size } of sizes) {
    const dir = join(outDir, density);
    const outPath = join(dir, 'ic_launcher_foreground.png');
    const iconSize = Math.max(1, Math.round(size * SAFE_SCALE));
    const left = Math.round((size - iconSize) / 2);
    const iconBuf = await sharp(sourcePath)
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: iconBuf, left, top: left }])
      .png()
      .toFile(outPath);
    console.log(`Wrote ${density}/ic_launcher_foreground.png (${size}x${size}, icon ${iconSize}px)`);
  }

  console.log('Done. Rebuild the APK to see the new home screen icon.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
