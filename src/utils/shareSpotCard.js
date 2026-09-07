import { getSpotImages, getSpotPrimaryImage } from './spotImages';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Spot photo could not be loaded for sharing.'));
    image.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchImageDataUrl(url) {
  if (!url) throw new Error('This spot does not have a photo to share.');
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const proxyUrl = supabaseUrl && supabaseKey
    ? `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`
    : null;

  const candidates = [
    { url, options: { mode: 'cors', cache: 'no-store' } },
    ...(proxyUrl ? [{
      url: proxyUrl,
      options: {
        mode: 'cors',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      },
    }] : []),
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, candidate.options);
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Image request returned a non-image response');
      return await blobToDataUrl(blob);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Spot photo could not be loaded for sharing.');
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawPin(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#f4b740';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(x, y - 6, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 6);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 10, y + 6);
  ctx.stroke();
  ctx.restore();
}

export async function createSpotSharePng({ spot, locationText = '' }) {
  const primaryImage = getSpotPrimaryImage(spot);
  const imageDataUrl = await fetchImageDataUrl(primaryImage);
  const image = await loadImage(imageDataUrl);

  const width = 1080;
  const photoHeight = 810;
  const height = 1240;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create share image.');

  ctx.fillStyle = '#0f0e12';
  ctx.fillRect(0, 0, width, height);
  drawCover(ctx, image, 0, 0, width, photoHeight);

  const gradient = ctx.createLinearGradient(0, photoHeight - 180, 0, photoHeight);
  gradient.addColorStop(0, 'rgba(15,14,18,0)');
  gradient.addColorStop(1, 'rgba(15,14,18,0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, photoHeight - 180, width, 180);

  const images = getSpotImages(spot);
  const photoBy = images[0]?.photoBy && images[0].photoBy !== 'Unknown' ? images[0].photoBy : '';
  if (photoBy) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`Photo by ${photoBy}`, 56, photoHeight - 42);
  }

  const left = 64;
  const maxWidth = width - left * 2;
  let y = photoHeight + 86;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 58px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  const titleLines = wrapText(ctx, spot?.name || 'SnapMap spot', maxWidth).slice(0, 2);
  for (const line of titleLines) {
    ctx.fillText(line, left, y);
    y += 70;
  }

  if (locationText) {
    y += 10;
    drawPin(ctx, left + 16, y + 15);
    ctx.fillStyle = '#a8b0c0';
    ctx.font = '500 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    const addressLines = wrapText(ctx, locationText, maxWidth - 58).slice(0, 2);
    addressLines.forEach((line, index) => {
      ctx.fillText(line, left + 58, y + index * 45);
    });
    y += Math.max(50, addressLines.length * 45);
  }

  if (spot?.bestTime && spot.bestTime !== 'Not specified') {
    y += 22;
    ctx.fillStyle = '#7f8797';
    ctx.font = '500 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`Best time: ${spot.bestTime}`, left, y);
  }

  ctx.fillStyle = '#f4b740';
  ctx.font = '800 31px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('SNAPMAP', left, height - 58);
  ctx.fillStyle = '#747b89';
  ctx.font = '500 25px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('snapmap.lol', width - left, height - 58);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
