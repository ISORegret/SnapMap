export function submissionStatus(item) {
  if (!item.targetId) return { label: item.claim ? 'Event removed' : 'Content removed', description: item.claim ? 'The event is no longer listed. This claim stays in your history.' : 'The reported content is no longer available. This report stays in your history.' };
  const states = {
    open: ['Awaiting review', 'Your report is in the moderation queue.'],
    pending: ['Awaiting review', 'Your ownership claim is waiting for review.'],
    reviewed: ['Reviewed', 'A moderator has reviewed this report.'],
    dismissed: ['Closed', 'A moderator closed this report without removing the content.'],
    resolved: ['Resolved', 'A moderator marked this issue as resolved.'],
    removed: ['Content removed', 'The reported content was removed.'],
    approved: ['Approved', 'Your ownership claim was approved. You can manage the event.'],
    rejected: ['Not approved', 'Your ownership claim was not approved.'],
  };
  const [label, description] = states[item.status] || ['Status unavailable', 'Refresh to check for an update.'];
  return { label, description };
}
