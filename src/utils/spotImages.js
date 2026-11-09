const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

function resizeImageFileToDataUrl(file, maxDim, quality) {
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
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Image processing is unavailable');
        ctx.drawImage(img, 0, 0, width, height);
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

export function resizeImageToDataUrl(file, maxDim = 1200, quality = 0.85) {
  return resizeImageFileToDataUrl(file, maxDim, quality);
}

/**
 * Resize an upload to a full-size data URL plus a small thumbnail data URL.
 * List views (Explore, map bottom sheet, feed) render the ~400px thumbnail
 * instead of the 1200px original, so scrolling a list no longer downloads
 * full-size base64 photos. The thumbnail is stored alongside the full image
 * in the spot's images JSON column ({ uri, thumbnail, photoBy, uploadedBy });
 * older records without a thumbnail fall back to the full image.
 */
export async function resizeImageWithThumbnail(file, maxDim = 1200, quality = 0.85, thumbDim = 400, thumbQuality = 0.8) {
  const [uri, thumbnail] = await Promise.all([
    resizeImageFileToDataUrl(file, maxDim, quality),
    resizeImageFileToDataUrl(file, thumbDim, thumbQuality),
  ]);
  return { uri, thumbnail };
}

/**
 * Returns an array of { uri, thumbnail, photoBy, uploadedBy } for a spot.
 * photoBy is the photographer credit; uploadedBy identifies who submitted the image.
 * Older images fall back to the spot creator as the uploader when available.
 * thumbnail is '' for records uploaded before thumbnails existed.
 */
export function getSpotImages(spot) {
  if (!spot) return [];
  const legacyUploader = (spot.createdByDisplayName || '').trim() || 'Unknown';
  if (spot.images?.length) {
    return spot.images.map((img) => ({
      uri: img.uri || DEFAULT_IMAGE,
      thumbnail: typeof img.thumbnail === 'string' ? img.thumbnail : '',
      photoBy: img.photoBy || 'Unknown',
      uploadedBy: img.uploadedBy || legacyUploader,
    }));
  }
  const uri = spot.imageUri?.trim() || DEFAULT_IMAGE;
  return [{
    uri,
    thumbnail: '',
    photoBy: spot.photoBy?.trim() || 'Unknown',
    uploadedBy: legacyUploader,
  }];
}

/** First image URI for cards / thumbnails */
export function getSpotPrimaryImage(spot) {
  const imgs = getSpotImages(spot);
  return imgs[0]?.uri || DEFAULT_IMAGE;
}

/** First image's thumbnail for list/card views; falls back to the full image. */
export function getSpotThumbnailImage(spot) {
  const imgs = getSpotImages(spot);
  return imgs[0]?.thumbnail || imgs[0]?.uri || DEFAULT_IMAGE;
}
