const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

export function resizeImageToDataUrl(file, maxDim = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Returns an array of { uri, photoBy } for a spot.
 * Supports both legacy (imageUri + photoBy) and new (images[]) shapes.
 */
export function getSpotImages(spot) {
  if (!spot) return [];
  if (spot.images?.length) {
    return spot.images.map((img) => ({
      uri: img.uri || DEFAULT_IMAGE,
      photoBy: img.photoBy || 'Unknown',
    }));
  }
  const uri = spot.imageUri?.trim() || DEFAULT_IMAGE;
  return [{ uri, photoBy: spot.photoBy?.trim() || 'Unknown' }];
}

/** First image URI for cards / thumbnails */
export function getSpotPrimaryImage(spot) {
  const imgs = getSpotImages(spot);
  return imgs[0]?.uri || DEFAULT_IMAGE;
}
