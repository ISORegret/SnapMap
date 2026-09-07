from pathlib import Path

path = Path('src/pages/SpotDetail.jsx')
text = path.read_text()

old_import = "import { toPng } from 'html-to-image';\n"
new_import = "import { createSpotSharePng } from '../utils/shareSpotCard';\n"
if old_import not in text:
    raise SystemExit('html-to-image import not found')
text = text.replace(old_import, new_import, 1)

if "  const shareCardRef = useRef(null);\n" not in text:
    raise SystemExit('shareCardRef declaration not found')
text = text.replace("  const shareCardRef = useRef(null);\n", "", 1)

start = text.index("  const shareAsImage = async () => {")
end = text.index("  const canReport =", start)
replacement = r'''  const shareAsImage = async () => {
    if (shareImageLoading) return;
    setShareImageError(null);
    setShareImageLoading(true);
    try {
      const shareLocationText = (spot.address && spot.address !== 'Not specified')
        ? spot.address
        : (latitude != null && longitude != null ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}` : '');
      const dataUrl = await createSpotSharePng({ spot, locationText: shareLocationText });
      const base64 = dataUrl.split(',')[1];
      if (!base64) throw new Error('Failed to create share image.');

      const safeName = (spot.name || 'spot')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .slice(0, 30);
      const fileName = `snapmap-${safeName || 'spot'}.png`;

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({
          url: uri,
          dialogTitle: 'Share spot image',
        });
      } else {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
      }
    } catch (e) {
      console.warn('Share as image failed', e);
      setShareImageError(e?.message || 'Could not share image');
    } finally {
      setShareImageLoading(false);
    }
  };

'''
text = text[:start] + replacement + text[end:]

text = text.replace("  const primaryImage = getSpotPrimaryImage(spot);\n", "", 1)

card_marker = "      {/* Card for share-as-image: in-view but invisible so mobile WebView renders it */}"
marker_start = text.index(card_marker)
marker_end = text.index("\n\n      <header", marker_start)
text = text[:marker_start] + text[marker_end + 2:]

if 'shareCardRef' in text:
    raise SystemExit('shareCardRef still present after patch')
if 'toPng' in text:
    raise SystemExit('toPng still present after patch')
if 'text: shareText' in text or 'const shareText =' in text:
    raise SystemExit('Old text share payload still present after patch')
if 'createSpotSharePng' not in text:
    raise SystemExit('Canvas share generator was not wired in')

path.write_text(text)
print('Patched src/pages/SpotDetail.jsx')
