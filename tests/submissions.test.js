import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionStatus } from '../src/utils/submissions.js';

test('deleted targets are not presented as pending reviews or actionable approvals', () => {
  assert.equal(submissionStatus({ status: 'open', targetId: null }).label, 'Content removed');
  assert.equal(submissionStatus({ status: 'approved', claim: true, targetId: null }).label, 'Event removed');
});
test('review outcomes stay distinct', () => {
  assert.equal(submissionStatus({ status: 'pending', targetId: 'event' }).label, 'Awaiting review');
  assert.equal(submissionStatus({ status: 'approved', targetId: 'event' }).label, 'Approved');
  assert.equal(submissionStatus({ status: 'rejected', targetId: 'event' }).label, 'Not approved');
  assert.equal(submissionStatus({ status: 'unexpected', targetId: 'event' }).label, 'Status unavailable');
});
