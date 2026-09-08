from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'Missing anchor for {label}')
    path.write_text(text.replace(old, new, 1))

spot = Path('src/pages/SpotDetail.jsx')
replace_once(
    spot,
    "  const [ratingLoading, setRatingLoading] = useState(false);\n",
    "  const [ratingLoading, setRatingLoading] = useState(false);\n  const [ratingOpen, setRatingOpen] = useState(false);\n  const [discussionOpen, setDiscussionOpen] = useState(false);\n",
    'engagement state',
)

old_checkins = '''        {hasSupabase && (\n          <div className="mt-3 flex items-center gap-2">\n            <span className="flex items-center gap-1.5 text-sm text-slate-500">\n              <MapPin className="h-4 w-4 shrink-0 text-accent-500/80" />\n              {checkInCount === 0\n                ? 'No check-ins yet'\n                : checkInCount === 1\n                  ? '1 person has been here'\n                  : `${checkInCount} people have been here`}\n            </span>\n            {!userHasCheckedIn ? (\n              <button\n                type="button"\n                onClick={async () => {\n                  setCheckInLoading(true);\n                  const result = await addCheckIn(spot.id, getDeviceId());\n                  setCheckInLoading(false);\n                  if (result.ok) {\n                    setUserHasCheckedIn(true);\n                    setCheckInCount((c) => c + 1);\n                  }\n                }}\n                disabled={checkInLoading}\n                className="shrink-0 rounded-lg bg-accent-500/20 px-3 py-1.5 text-xs font-medium text-accent-400 transition hover:bg-accent-500/30 disabled:opacity-50"\n              >\n                {checkInLoading ? '…' : 'I was here'}\n              </button>\n            ) : (\n              <span className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-400">You&apos;ve been here</span>\n            )}\n          </div>\n        )}\n'''
new_checkins = '''        {hasSupabase && (\n          <div className="mt-3 flex flex-wrap items-center gap-2">\n            {(checkInCount > 0 || userHasCheckedIn) && <span className="flex items-center gap-1.5 text-sm text-slate-500">\n              <MapPin className="h-4 w-4 shrink-0 text-accent-500/80" />\n              {checkInCount === 1 ? '1 person has been here' : `${checkInCount} people have been here`}\n            </span>}\n            {!userHasCheckedIn ? (\n              <button\n                type="button"\n                onClick={async () => {\n                  setCheckInLoading(true);\n                  const result = await addCheckIn(spot.id, getDeviceId());\n                  setCheckInLoading(false);\n                  if (result.ok) {\n                    setUserHasCheckedIn(true);\n                    setCheckInCount((c) => c + 1);\n                  }\n                }}\n                disabled={checkInLoading}\n                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-secondary transition hover:border-accent-500/25 hover:text-accent-400 disabled:opacity-50"\n              >\n                <MapPin className="h-3.5 w-3.5" />{checkInLoading ? '…' : 'I was here'}\n              </button>\n            ) : (\n              <span className="shrink-0 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-400">You&apos;ve been here</span>\n            )}\n          </div>\n        )}\n'''
replace_once(spot, old_checkins, new_checkins, 'check-in density')

old_rating = '''        {hasSupabase && (\n          <div className="mt-3 flex items-center gap-2 flex-wrap">\n            <span className="text-sm text-slate-500">Rating:</span>\n            <div className="flex items-center gap-0.5" role="group" aria-label="Rate this spot">\n              {[1, 2, 3, 4, 5].map((star) => (\n                <button\n                  key={star}\n                  type="button"\n                  onClick={async () => {\n                    setRatingLoading(true);\n                    const ok = await setSpotRating(spot.id, getDeviceId(), star);\n                    setRatingLoading(false);\n                    if (ok) {\n                      setUserRating(star);\n                      const r = await getSpotRating(spot.id);\n                      setRating(r);\n                    }\n                  }}\n                  disabled={ratingLoading}\n                  className="rounded p-0.5 text-amber-400 transition hover:scale-110 disabled:opacity-50"\n                  aria-label={`${star} star${star > 1 ? 's' : ''}`}\n                >\n                  <Star\n                    className="h-5 w-5"\n                    fill={userRating != null && star <= userRating ? 'currentColor' : 'transparent'}\n                    stroke="currentColor"\n                    strokeWidth={1.5}\n                  />\n                </button>\n              ))}\n            </div>\n            <span className="text-sm text-slate-500">\n              {rating.count === 0 ? 'No ratings yet' : `${rating.average.toFixed(1)} (${rating.count})`}\n            </span>\n          </div>\n        )}\n'''
new_rating = '''        {hasSupabase && (rating.count > 0 || userRating != null || ratingOpen ? (\n          <div className="mt-3 flex flex-wrap items-center gap-2">\n            {rating.count > 0 && <span className="text-sm font-semibold text-secondary">{rating.average.toFixed(1)} <span className="font-normal text-muted">({rating.count})</span></span>}\n            <div className="flex items-center gap-0.5" role="group" aria-label="Rate this spot">\n              {[1, 2, 3, 4, 5].map((star) => (\n                <button\n                  key={star}\n                  type="button"\n                  onClick={async () => {\n                    setRatingLoading(true);\n                    const ok = await setSpotRating(spot.id, getDeviceId(), star);\n                    setRatingLoading(false);\n                    if (ok) {\n                      setUserRating(star);\n                      const r = await getSpotRating(spot.id);\n                      setRating(r);\n                      setRatingOpen(false);\n                    }\n                  }}\n                  disabled={ratingLoading}\n                  className="rounded p-0.5 text-amber-400 transition hover:scale-110 disabled:opacity-50"\n                  aria-label={`${star} star${star > 1 ? 's' : ''}`}\n                >\n                  <Star className="h-5 w-5" fill={userRating != null && star <= userRating ? 'currentColor' : 'transparent'} stroke="currentColor" strokeWidth={1.5} />\n                </button>\n              ))}\n            </div>\n            {userRating != null && <span className="text-xs font-bold text-muted">Your rating: {userRating}</span>}\n          </div>\n        ) : (\n          <button type="button" onClick={() => setRatingOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-secondary transition hover:border-amber-400/30 hover:text-amber-400">\n            <Star className="h-3.5 w-3.5" />Rate this spot\n          </button>\n        ))}\n'''
replace_once(spot, old_rating, new_rating, 'rating density')

replace_once(
    spot,
    "        {canAddNotes && (\n          <div className=\"mt-5\">",
    "        {canAddNotes && (visibleNotes.length > 0 || discussionOpen) && (\n          <div className=\"mt-5\">",
    'discussion conditional',
)
replace_once(spot, "{notes.length}</span>", "{visibleNotes.length}</span>", 'visible discussion count')
# Insert the invitation directly after the full discussion block closes and before Share.
anchor = '''        )}\n\n        {/* Share / Copy */}\n'''
replacement = '''        )}\n        {canAddNotes && visibleNotes.length === 0 && !discussionOpen && (\n          <button type="button" onClick={() => setDiscussionOpen(true)} className="mt-5 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition hover:border-accent-500/25 hover:bg-accent-500/[0.04]">\n            <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-accent-400" /><span><span className="block text-sm font-extrabold text-primary">Start a location discussion</span><span className="mt-0.5 block text-xs text-muted">Ask about access, lighting, or current conditions.</span></span></span>\n            <Reply className="h-4 w-4 rotate-180 text-muted" />\n          </button>\n        )}\n\n        {/* Share / Copy */}\n'''
replace_once(spot, anchor, replacement, 'discussion invitation')

# Audit backlog bookkeeping.
audit = Path('docs/PRODUCT_AUDIT_2026-09-08.md')
text = audit.read_text()
text = text.replace(
    '1. Show ratings, comments, check-ins, and live activity only when they have data or clear user intent.\n',
    '- Completed: ratings, comments, and check-ins now stay compact until they have data or the user explicitly opens/uses them.\n',
    1,
)
audit.write_text(text)

print('Contextual engagement patch applied.')
