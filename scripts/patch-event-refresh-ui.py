from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'Missing anchor for {label} in {path}')
    path.write_text(text.replace(old, new, 1))


events = Path('src/api/events.js')
text = events.read_text()

anchor = '''const EVENT_SELECT_WITH_STATUS = EVENT_SELECT_WITH_COVER.replace(
  'rsvps:event_rsvps(user_id, created_at,',
  'rsvps:event_rsvps(user_id, status, created_at,'
);
'''
insert = anchor + '''\nconst EVENT_SELECT_WITH_FRESHNESS = EVENT_SELECT_WITH_STATUS.replace(\n  'event_type, venue_name, address, latitude, longitude, cover_image_url, cover_image_path, listing_type, source_label,',\n  'event_type, venue_name, address, latitude, longitude, cover_image_url, cover_image_path, listing_type, source_label, source_url, source_updated_at, last_verified_at, source_status, official_url,',\n);\n'''
if anchor not in text:
    raise SystemExit('Missing freshness select anchor')
text = text.replace(anchor, insert, 1)

anchor = '''    listingType: event.listing_type || 'hosted',
    sourceLabel: event.source_label || 'SnapMap community',
    createdAt: event.created_at,
'''
insert = '''    listingType: event.listing_type || 'hosted',
    sourceLabel: event.source_label || 'SnapMap community',
    sourceUrl: event.source_url || '',
    sourceUpdatedAt: event.source_updated_at || null,
    lastVerifiedAt: event.last_verified_at || null,
    sourceStatus: event.source_status || 'active',
    officialUrl: event.official_url || '',
    createdAt: event.created_at,
'''
if anchor not in text:
    raise SystemExit('Missing normalization anchor')
text = text.replace(anchor, insert, 1)

old = "let { data, error } = await supabase.from('events').select(EVENT_SELECT_WITH_STATUS)\n    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())"
new = "let { data, error } = await supabase.from('events').select(EVENT_SELECT_WITH_FRESHNESS)\n    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())"
if old not in text:
    raise SystemExit('Missing upcoming freshness query')
text = text.replace(old, new, 1)

old = "let { data, error } = await supabase.from('events').select(EVENT_SELECT_WITH_STATUS).eq('id', eventId).maybeSingle();"
new = "let { data, error } = await supabase.from('events').select(EVENT_SELECT_WITH_FRESHNESS).eq('id', eventId).maybeSingle();"
if old not in text:
    raise SystemExit('Missing detail freshness query')
text = text.replace(old, new, 1)

text = text.replace("Math.min(Math.max(Number(limit) || 50, 1), 100)", "Math.min(Math.max(Number(limit) || 50, 1), 200)")

old = "  return { events: (data || []).map((event) => normalizeEvent(event, userId)), error: null };"
new = "  const events = (data || []).map((event) => normalizeEvent(event, userId))\n    .filter((event) => event.listingType !== 'listed' || event.sourceStatus === 'active');\n  return { events, error: null };"
if old not in text:
    raise SystemExit('Missing upcoming return anchor')
text = text.replace(old, new, 1)
events.write_text(text)

hub = Path('src/components/EventHub.jsx')
text = hub.read_text()
anchor = '''function eventDate(value) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}
'''
insert = anchor + '''\nfunction verifiedLabel(value) {\n  if (!value) return '';\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) return '';\n  return `Verified ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;\n}\n'''
if anchor not in text:
    raise SystemExit('Missing EventHub date helper')
text = text.replace(anchor, insert, 1)
text = text.replace('const result = await fetchUpcomingEvents(100);', 'const result = await fetchUpcomingEvents(150);', 1)
old = 'Listed from {event.sourceLabel}</span>'
new = "Listed from {event.sourceLabel}{event.lastVerifiedAt ? ` · ${verifiedLabel(event.lastVerifiedAt)}` : ''}</span>"
if old not in text:
    raise SystemExit('Missing EventHub source label')
text = text.replace(old, new, 1)
hub.write_text(text)

map_path = Path('src/pages/Map.jsx')
text = map_path.read_text()
if 'fetchUpcomingEvents(100)' not in text:
    raise SystemExit('Missing Map event fetch limit')
map_path.write_text(text.replace('fetchUpcomingEvents(100)', 'fetchUpcomingEvents(150)', 1))

page = Path('src/pages/EventDetail.jsx')
text = page.read_text()
anchor = '''function fullDate(value) {
  return new Date(value).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
'''
insert = anchor + '''\nfunction verifiedLabel(value) {\n  if (!value) return '';\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) return '';\n  return `Verified ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;\n}\n'''
if anchor not in text:
    raise SystemExit('Missing EventDetail date helper')
text = text.replace(anchor, insert, 1)

old = '''      <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6">
        <section className="surface-card overflow-hidden rounded-[1.75rem]">
'''
new = '''      <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6">
        {event.listingType === 'listed' && event.sourceStatus !== 'active' && (
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
            This listing is no longer active on the source calendar. Check the organizer before making plans.
          </div>
        )}
        <section className="surface-card overflow-hidden rounded-[1.75rem]">
'''
if old not in text:
    raise SystemExit('Missing EventDetail main anchor')
text = text.replace(old, new, 1)

old = '''{event.listingType === 'listed' ? <span className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><CalendarDays className="h-4 w-4 text-accent-400" />Listed from {event.sourceLabel}</span> :'''
new = '''{event.listingType === 'listed' ? <span className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><CalendarDays className="h-4 w-4 text-accent-400" />Listed from {event.sourceLabel}{event.lastVerifiedAt ? ` · ${verifiedLabel(event.lastVerifiedAt)}` : ''}</span> :'''
if old not in text:
    raise SystemExit('Missing EventDetail source chip')
text = text.replace(old, new, 1)

anchor = '''              {!hasCoordinates && hasAddress && <DirectionsLauncher googleUrl={googleAddressUrl} appleUrl={appleAddressUrl} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><Navigation className="h-4 w-4 text-accent-400" />Directions</DirectionsLauncher>}
'''
insert = anchor + '''              {event.listingType === 'listed' && (event.officialUrl || event.sourceUrl) && <a href={event.officialUrl || event.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><CalendarDays className="h-4 w-4 text-accent-400" />{event.officialUrl ? 'Official listing' : 'Source calendar'}</a>}\n'''
if anchor not in text:
    raise SystemExit('Missing EventDetail external source anchor')
text = text.replace(anchor, insert, 1)
page.write_text(text)
