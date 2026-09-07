from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Required pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count))
    print(f"patched {path}")


# Preserve separate photographer and uploader attribution in normalized spot images.
replace(
    'src/utils/spotImages.js',
    """/**\n * Returns an array of { uri, photoBy } for a spot.\n * Supports both legacy (imageUri + photoBy) and new (images[]) shapes.\n */\nexport function getSpotImages(spot) {\n  if (!spot) return [];\n  if (spot.images?.length) {\n    return spot.images.map((img) => ({\n      uri: img.uri || DEFAULT_IMAGE,\n      photoBy: img.photoBy || 'Unknown',\n    }));\n  }\n  const uri = spot.imageUri?.trim() || DEFAULT_IMAGE;\n  return [{ uri, photoBy: spot.photoBy?.trim() || 'Unknown' }];\n}\n""",
    """/**\n * Returns an array of { uri, photoBy, uploadedBy } for a spot.\n * photoBy is the photographer credit; uploadedBy identifies who submitted the image.\n * Older images fall back to the spot creator as the uploader when available.\n */\nexport function getSpotImages(spot) {\n  if (!spot) return [];\n  const legacyUploader = (spot.createdByDisplayName || '').trim() || 'Unknown';\n  if (spot.images?.length) {\n    return spot.images.map((img) => ({\n      uri: img.uri || DEFAULT_IMAGE,\n      photoBy: img.photoBy || 'Unknown',\n      uploadedBy: img.uploadedBy || legacyUploader,\n    }));\n  }\n  const uri = spot.imageUri?.trim() || DEFAULT_IMAGE;\n  return [{\n    uri,\n    photoBy: spot.photoBy?.trim() || 'Unknown',\n    uploadedBy: legacyUploader,\n  }];\n}\n"""
)

# Share card: render both credits independently.
replace(
    'src/utils/shareSpotCard.js',
    """  const images = getSpotImages(spot);\n  const photoBy = images[0]?.photoBy && images[0].photoBy !== 'Unknown' ? images[0].photoBy : '';\n  if (photoBy) {\n    ctx.fillStyle = 'rgba(255,255,255,0.88)';\n    ctx.font = '500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';\n    ctx.fillText(`Uploaded by ${photoBy}`, 56, photoHeight - 42);\n  }\n""",
    """  const images = getSpotImages(spot);\n  const photoBy = images[0]?.photoBy && images[0].photoBy !== 'Unknown' ? images[0].photoBy : '';\n  const uploadedBy = images[0]?.uploadedBy && images[0].uploadedBy !== 'Unknown' ? images[0].uploadedBy : '';\n  if (photoBy || uploadedBy) {\n    ctx.fillStyle = 'rgba(255,255,255,0.88)';\n    ctx.font = '500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';\n    if (photoBy) ctx.fillText(`Photo by ${photoBy}`, 56, photoHeight - (uploadedBy ? 76 : 42));\n    if (uploadedBy) ctx.fillText(`Uploaded by ${uploadedBy}`, 56, photoHeight - 38);\n  }\n"""
)

# Add/edit spot: capture uploader automatically while leaving photographer credit editable.
replace(
    'src/pages/Add.jsx',
    "const [images, setImages] = useState([]); // [{ uri, photoBy }]",
    "const [images, setImages] = useState([]); // [{ uri, photoBy, uploadedBy }]"
)
replace(
    'src/pages/Add.jsx',
    """    const defaultPhotoBy = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()\n      || 'You';\n    Promise.all(files.map((file) => resizeImageToDataUrl(file, MAX_IMAGE_DIM, 0.85)))\n      .then((dataUrls) => {\n        setImages((prev) => [...prev, ...dataUrls.map((uri) => ({ uri, photoBy: defaultPhotoBy }))]);\n      })\n""",
    """    const uploaderName = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()\n      || 'SnapMap user';\n    Promise.all(files.map((file) => resizeImageToDataUrl(file, MAX_IMAGE_DIM, 0.85)))\n      .then((dataUrls) => {\n        setImages((prev) => [...prev, ...dataUrls.map((uri) => ({\n          uri,\n          photoBy: uploaderName,\n          uploadedBy: uploaderName,\n        }))]);\n      })\n"""
)
replace(
    'src/pages/Add.jsx',
    """    const creatorPhotoBy = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()\n      || 'You';\n    const validImages = images\n      .filter((img) => img?.uri && String(img.uri).trim())\n      .map((img) => {\n        const by = (img.photoBy || 'You').trim();\n        const photoBy = (by === 'You' && currentUserProfile) ? creatorPhotoBy : by;\n        return { uri: img.uri.trim(), photoBy };\n      });\n""",
    """    const creatorPhotoBy = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()\n      || 'SnapMap user';\n    const fallbackUploader = (editSpot?.createdByDisplayName || '').trim() || creatorPhotoBy;\n    const validImages = images\n      .filter((img) => img?.uri && String(img.uri).trim())\n      .map((img) => {\n        const by = (img.photoBy || creatorPhotoBy).trim();\n        const photoBy = (by === 'You' && currentUserProfile) ? creatorPhotoBy : by;\n        const uploadedBy = String(img.uploadedBy || fallbackUploader).trim() || fallbackUploader;\n        return { uri: img.uri.trim(), photoBy, uploadedBy };\n      });\n"""
)
replace(
    'src/pages/Add.jsx',
    "const finalImages = validImages.length ? validImages : [{ uri: DEFAULT_IMAGE, photoBy: 'You' }];",
    "const finalImages = validImages.length ? validImages : [{ uri: DEFAULT_IMAGE, photoBy: creatorPhotoBy, uploadedBy: fallbackUploader }];"
)
replace(
    'src/pages/Add.jsx',
    """                <input\n                  type=\"text\"\n                  value={img.photoBy || ''}\n                  onChange={(e) => setPhotoBy(index, e.target.value)}\n                  placeholder=\"Photo by (e.g. You, @handle)\"\n                  className=\"mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500\"\n                />\n""",
    """                <input\n                  type=\"text\"\n                  value={img.photoBy || ''}\n                  onChange={(e) => setPhotoBy(index, e.target.value)}\n                  placeholder=\"Photo by (photographer name)\"\n                  className=\"mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500\"\n                />\n                <p className=\"mt-1 px-1 text-[11px] text-slate-500\">\n                  Uploaded by {img.uploadedBy || (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim() || editSpot?.createdByDisplayName || 'SnapMap user'}\n                </p>\n"""
)

# Spot detail gallery: expose both credits, and mark newly-added photos with both fields.
replace(
    'src/pages/SpotDetail.jsx',
    """            <p className=\"absolute bottom-8 left-2 right-2 text-center text-[10px] text-white/80 drop-shadow\">\n              Photo by {current.photoBy} · {index + 1}/{images.length}\n            </p>\n""",
    """            <div className=\"absolute bottom-7 left-2 right-2 text-center text-[10px] text-white/80 drop-shadow\">\n              <p>Photo by {current.photoBy}</p>\n              <p className=\"mt-0.5\">Uploaded by {current.uploadedBy} · {index + 1}/{images.length}</p>\n            </div>\n"""
)
replace(
    'src/pages/SpotDetail.jsx',
    """        {images.length === 1 && current.photoBy && (\n          <p className=\"absolute bottom-2 left-2 text-[10px] text-white/80 drop-shadow\">\n            Photo by {current.photoBy}\n          </p>\n        )}\n""",
    """        {images.length === 1 && (current.photoBy || current.uploadedBy) && (\n          <div className=\"absolute bottom-2 left-2 text-[10px] text-white/80 drop-shadow\">\n            {current.photoBy && <p>Photo by {current.photoBy}</p>}\n            {current.uploadedBy && <p className=\"mt-0.5\">Uploaded by {current.uploadedBy}</p>}\n          </div>\n        )}\n"""
)
replace(
    'src/pages/SpotDetail.jsx',
    "updateSpot(spot.id, { images: [...current, { uri: dataUrl, photoBy: attributedTo }] });",
    "updateSpot(spot.id, { images: [...current, { uri: dataUrl, photoBy: attributedTo, uploadedBy: attributedTo }] });"
)

print('photo attribution patch complete')
