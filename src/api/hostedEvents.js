import { createEventSeries, replaceEventCoverImage } from './events';

export async function createHostedEventSeries({ coverPhoto = null, venueName = '', address = '', ...form }) {
  // Venue/address belong in the initial insert. Keeping them out of a second update
  // prevents recurring series from being partially created when one follow-up save
  // fails after the events already exist.
  const created = await createEventSeries({
    ...form,
    spotId: form.spotId || null,
    venueName: venueName.trim(),
    address: address.trim(),
  });

  if (created.error || !created.events?.length) return created;

  let events = created.events;
  const warnings = [];

  // The cover image necessarily happens after the event has an id. If an upload
  // fails, keep the successfully-created event and surface a non-destructive warning.
  if (coverPhoto?.blob) {
    const covered = await Promise.all(events.map(async (event) => {
      const result = await replaceEventCoverImage(event, coverPhoto);
      if (result.error) return { event, error: result.error };
      return { event: result.event, error: null };
    }));

    const failed = covered.find((item) => item.error);
    if (failed) warnings.push(`Event created, but the cover photo could not be saved: ${failed.error}`);
    events = covered.map((item) => item.event);
  }

  return {
    ...created,
    events,
    event: events[0] || created.event,
    warning: warnings.join(' '),
  };
}
