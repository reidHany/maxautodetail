import express from 'express';
import { BookingPayload, AdminLoginRequest } from './types';
import { createAdminToken, canAttemptLogin, getAdminPassword, getIp, isAdminTokenValid, recordLoginAttempt } from './authService';
import { createBooking, getAvailableTimes, getDefaultTimes, getSupportedServices, listBookings } from './bookingService';
import { sendBookingConfirmation } from './emailService';

const router = express.Router();

router.get('/available-times', async (req, res) => {
  const date = String(req.query.date || '');
  if (!date) {
    return res.status(400).json({ message: 'Date query parameter is required.' });
  }

  const bookings = await listBookings();
  const availableTimes = getAvailableTimes(date, bookings);
  res.json({ availableTimes });
});

router.get('/services', (_req, res) => {
  res.json({ services: getSupportedServices(), defaultTimes: getDefaultTimes() });
});

router.post('/bookings', async (req: express.Request<{}, {}, BookingPayload>, res) => {
  const { name, email, service, date, time, notes, addressLine1, addressLine2, city, state, zip, address } = req.body;
  if (!name || !email || !service || !date || !time) {
    return res.status(400).json({ message: 'Missing required booking fields.' });
  }

  const booking = await createBooking({ name, email, service, date, time, notes, addressLine1, addressLine2, city, state, zip, address });
  if (!booking) {
    return res.status(409).json({ message: 'Selected time is no longer available.' });
  }

  // attempt to send confirmation email (best-effort)
  try {
    await sendBookingConfirmation(booking);
  } catch (err) {
    // log but don't fail the booking
    // eslint-disable-next-line no-console
    console.error('Failed to send booking confirmation', err);
  }

  res.status(201).json({ id: booking.id });
});

router.post('/admin/login', (req: express.Request<{}, {}, AdminLoginRequest>, res) => {
  const password = String(req.body.password || '');
  const ip = getIp(req);
  if (!canAttemptLogin(ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  if (password !== getAdminPassword()) {
    recordLoginAttempt(ip);
    return res.status(401).json({ message: 'Invalid admin password.' });
  }

  const token = createAdminToken();
  res.json({ token });
});

router.get('/admin/bookings', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!isAdminTokenValid(token)) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const bookings = await listBookings();
  res.json({ bookings });
});

export default router;
