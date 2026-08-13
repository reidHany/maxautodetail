const assert = require('node:assert/strict');
const { rmSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const databasePath = resolve('server', 'test-bookings.sqlite');
process.env.DATABASE_PATH = databasePath;

const storage = require('../dist-server/storage.js');
const scheduling = require('../dist-server/bookingService.js');

test('multi-hour services cannot overlap', async () => {
  const base = {
    name: 'Automated test', email: 'test@example.com', service: 'Exterior Refresh',
    date: '2099-11-15', transportService: false,
  };
  const first = await scheduling.createBooking({ ...base, time: '08:00' });
  const overlapping = await scheduling.createBooking({ ...base, time: '09:00' });
  const adjacent = await scheduling.createBooking({ ...base, time: '10:00' });
  assert.ok(first);
  assert.equal(overlapping, null);
  assert.ok(adjacent);
});

test('blocked hours suppress every overlapping start', async () => {
  const date = '2099-11-16';
  await scheduling.setTimeBlocked(date, '10:00', true);
  const times = await scheduling.getAvailableTimes(date, 'Complete Refresh');
  assert.equal(times.includes('08:00'), false);
  assert.equal(times.includes('09:00'), false);
  assert.equal(times.includes('10:00'), false);
  assert.equal(times.includes('11:00'), true);
});

test('cancelling preserves history and releases the appointment', async () => {
  const base = {
    name: 'Cancellation test', email: 'cancel@example.com', service: 'Interior Refresh',
    date: '2099-11-17', time: '08:00', transportService: false,
  };
  const booking = await scheduling.createBooking(base);
  assert.ok(booking);
  const cancelled = await scheduling.cancelBooking(booking.id, 'The shop will be closed for maintenance.');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellationReason, 'The shop will be closed for maintenance.');
  const replacement = await scheduling.createBooking({ ...base, name: 'Replacement customer', email: 'replacement@example.com' });
  assert.ok(replacement);
});

test('past dates cannot be booked or returned as available', async () => {
  const date = '2000-01-01';
  const times = await scheduling.getAvailableTimes(date, 'Exterior Refresh');
  assert.deepEqual(times, []);
  const booking = await scheduling.createBooking({
    name: 'Past customer', email: 'past@example.com', service: 'Exterior Refresh',
    date, time: '08:00', transportService: false,
  });
  assert.equal(booking, null);
});

test.after(() => {
  storage.closeDatabase();
  for (const suffix of ['', '-shm', '-wal']) {
    try { rmSync(`${databasePath}${suffix}`); } catch { /* already removed */ }
  }
});
