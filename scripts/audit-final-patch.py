from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new))

# Never promote internal usernames into public creator/uploader labels.
replace(
    'src/api/spots.js',
    "  const uploader = String(row?.created_by_display_name || row?.created_by || '').trim();",
    "  const uploader = String(row?.created_by_display_name || '').trim();",
)
replace(
    'src/api/spots.js',
    "    createdByDisplayName: row.created_by_display_name ?? row.created_by ?? '',",
    "    createdByDisplayName: row.created_by_display_name ?? '',",
)
replace(
    'src/api/spots.js',
    "    created_by_display_name: ((spot.createdByDisplayName ?? '').trim().slice(0, 200)) || ((spot.createdBy ?? '').trim().slice(0, 100)) || '',",
    "    created_by_display_name: ((spot.createdByDisplayName ?? '').trim().slice(0, 200)) || '',",
)

# A display-name edit should refresh this callback even when the internal username is unchanged.
replace(
    'src/App.jsx',
    "    [userSpots, currentUserProfile?.username]\n  );",
    "    [userSpots, currentUserProfile]\n  );",
)

# Keep local and cloud favorites symmetric when an unsave request fails.
replace(
    'src/App.jsx',
    "        } else {\n          const ok = await removeFavoriteApi(effectiveSyncCode, spotId);\n          setSyncStatus(ok ? 'saved' : 'failed');\n        }",
    "        } else {\n          const ok = await removeFavoriteApi(effectiveSyncCode, spotId);\n          if (!ok) {\n            setFavoriteIds(favoriteIds);\n            saveFavorites(favoriteIds);\n            setSyncStatus('failed');\n            showToast('Could not sync removed spot.');\n          } else {\n            setSyncStatus('saved');\n          }\n        }",
)

# Spot page correctness: units should refetch weather and zero-degree coordinates are valid.
replace(
    'src/pages/SpotDetail.jsx',
    "  }, [latitude, longitude, retry]);",
    "  }, [latitude, longitude, units, retry]);",
)
replace(
    'src/pages/SpotDetail.jsx',
    "    if (!spot?.latitude || !spot?.longitude) return null;",
    "    if (spot?.latitude == null || spot?.longitude == null) return null;",
)

# last_edited_by has contained both legacy internal usernames and newer display names.
# Resolve known legacy identifiers to a display name and never expose a username as a label.
anchor = "function photoByLabel(profile) {\n  if (!profile) return 'You';\n  const name = (profile.display_name || profile.displayName || '').trim();\n  if (name) return name;\n  return 'SnapMap user';\n}\n"
replacement = anchor + "\nfunction publicEditorLabel(spot, profile) {\n  const raw = String(spot?.lastEditedBy || '').trim();\n  if (!raw) return '';\n  const profileUsername = String(profile?.username || '').trim();\n  const profileDisplayName = String(profile?.display_name || profile?.displayName || '').trim();\n  if (profileUsername && raw.toLowerCase() === profileUsername.toLowerCase()) return profileDisplayName || 'SnapMap user';\n  const creatorUsername = String(spot?.createdBy || '').trim();\n  const creatorDisplayName = String(spot?.createdByDisplayName || '').trim();\n  if (creatorUsername && raw.toLowerCase() === creatorUsername.toLowerCase()) return creatorDisplayName || 'SnapMap user';\n  // Legacy versions stored lowercase account handles here. Hide those rather than\n  // leaking the internal route/login identifier into the public UI.\n  if (/^[a-z0-9_]{1,32}$/.test(raw)) return 'SnapMap user';\n  return raw;\n}\n"
replace('src/pages/SpotDetail.jsx', anchor, replacement)

old_editor = """        {(spot.lastEditedBy != null && String(spot.lastEditedBy).trim()) ? (\n          <p className=\"mt-0.5 text-xs text-slate-500\">\n            Last edited by{' '}\n            <Link\n              to={`/user/${encodeURIComponent(String(spot.lastEditedBy).trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_'))}`}\n              className=\"text-accent-400 hover:underline\"\n            >\n              {(currentUserProfile?.username === String(spot.lastEditedBy).trim() ? (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim() : '') || (String(spot.createdBy || '').trim() === String(spot.lastEditedBy).trim() ? String(spot.createdByDisplayName || '').trim() : '') || 'SnapMap user'}\n            </Link>\n          </p>\n        ) : null}\n"""
new_editor = """        {(spot.lastEditedBy != null && String(spot.lastEditedBy).trim()) ? (\n          <p className=\"mt-0.5 text-xs text-slate-500\">\n            Last edited by <span className=\"text-accent-400\">{publicEditorLabel(spot, currentUserProfile)}</span>\n          </p>\n        ) : null}\n"""
replace('src/pages/SpotDetail.jsx', old_editor, new_editor)

# Unsigned/local spots should not solicit a public-looking account handle.
old_unsigned = """          ) : (\n            <>\n              <p className=\"mt-0.5 text-[11px] text-slate-500\">Show as &quot;Added by @handle&quot; or leave blank for Anonymous.</p>\n              <div className=\"mt-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2\">\n                <div className=\"h-8 w-8 shrink-0 overflow-hidden rounded-full bg-accent-500/20\">\n                  <div className=\"flex h-full w-full items-center justify-center text-accent-400\"><User className=\"h-4 w-4\" /></div>\n                </div>\n                <input\n                  type=\"text\"\n                  value={createdBy}\n                  onChange={(e) => setCreatedBy(e.target.value)}\n                  placeholder=\"e.g. yourname\"\n                  className=\"min-w-0 flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none\"\n                />\n              </div>\n            </>\n          )}\n"""
new_unsigned = """          ) : (\n            <p className=\"mt-1 rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-xs text-slate-500\">\n              Saved as Anonymous on this device. Sign in to publish spots under your display name.\n            </p>\n          )}\n"""
replace('src/pages/Add.jsx', old_unsigned, new_unsigned)

print('Final audit patch applied.')
