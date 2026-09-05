import { createEventSeries, replaceEventCoverImage, updateEvent } from './events';

export async function createHostedEventSeries({ coverPhoto = null, venueName = '', address = '', ...form }) {
  const created = await createEventSeries({
    ...form,
    spotId: form.spotId || null,
  });

  if (created.error || !created.events?.length) return created;

  let events = created.events;
  const warnings = [];

  if (venueName.trim() || address.trim()) {
    const updated = await Promise.all(events.map(async (event) => {
      const result = await updateEvent(event.id, {
        title: event.title,
        description: event.description,
        venueName: venueName.trim(),
        address: address.trim(),
        eventType: event.eventType,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        maxAttendees: event.maxAttendees,
        latitude: event.latitude,
        longitude: event.longitude,
      });
      if (result.error) return { event, error: result.error };
      return { event: result.event, error: null };
    }));

    const failed = updated.find((item) => item.error);
    if (failed) warnings.push(`Event created, but venue details could not be saved: ${failed.error}`);
    events = updated.map((item) => item.event);
  }

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
