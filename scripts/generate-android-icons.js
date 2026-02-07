/**
 * Generates Android mipmap launcher foreground icons from public/snapmap-icon.png.
 * Run: node scripts/generate-android-icons.js
 * Requires: npm install sharp --save-dev
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Wrote ${density}/ic_launcher_foreground.png (${size}x${size})`);
  }

  console.log('Done. Rebuild the APK to see the new home screen icon.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
