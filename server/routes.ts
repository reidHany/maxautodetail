import express from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { BookingPayload, AdminLoginRequest } from './types';
import { createAdminToken, canAttemptLogin, getIp, isAdminPasswordValid, isAdminTokenValid, recordLoginAttempt } from './authService';
import { cancelBooking, createBooking, getAvailability, getAvailableTimes, getDefaultTimes, getSupportedServices, listBookings, setTimeBlocked } from './bookingService';
import { sendBookingCancellation, sendBookingConfirmation } from './emailService';
import { getBusinessDate, isPastBusinessDate } from './serviceCatalog';

const router = express.Router();
const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

function getCookie(req: express.Request, name: string) {
  const cookies = req.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const cookie = cookies.find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function requireAdmin(req: express.Request, res: express.Response) {
  if (!isAdminTokenValid(getCookie(req, 'admin_session'))) {
    res.status(401).json({ message: 'Unauthorized.' });
    return false;
  }
  return true;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (date) => !isPastBusinessDate(date),
  'Date cannot be in the past.',
);
const bookingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  service: z.string().trim().max(80),
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  address: z.string().trim().min(5).max(300),
  addressLine1: z.string().trim().min(3).max(120),
  addressLine2: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(80),
  state: z.string().regex(/^[A-Z]{2}$/),
  zip: z.string().regex(/^\d{5}(?:-\d{4})?$/),
  transportService: z.boolean().optional().default(false),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
}).strict().refine((booking) => getSupportedServices().some((service) => service.title === booking.service), {
  message: 'Unsupported service.', path: ['service'],
});
const availabilityUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  blocked: z.boolean(),
}).strict();
const cancellationSchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();

router.get('/available-times', async (req, res) => {
  const date = String(req.query.date || '');
  const service = String(req.query.service || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !service) return res.status(400).json({ message: 'Valid date and service are required.' });
  if (isPastBusinessDate(date)) return res.status(400).json({ message: 'Past dates cannot be booked.' });

  const bookings = await listBookings();
  const availableTimes = await getAvailableTimes(date, service, bookings);
  res.json({ availableTimes });
});

router.get('/services', (_req, res) => {
  res.json({ services: getSupportedServices(), defaultTimes: getDefaultTimes(), minimumDate: getBusinessDate() });
});

router.post('/bookings', bookingLimiter, async (req: express.Request<{}, {}, BookingPayload>, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid booking details.' });
  const booking = await createBooking(parsed.data);
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

router.post('/admin/login', loginLimiter, (req: express.Request<{}, {}, AdminLoginRequest>, res) => {
  const password = String(req.body.password || '');
  const ip = getIp(req);
  if (!canAttemptLogin(ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  if (!isAdminPasswordValid(password)) {
    recordLoginAttempt(ip);
    return res.status(401).json({ message: 'Invalid admin password.' });
  }

  const token = createAdminToken();
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000,
    path: '/',
  });
  res.json({ authenticated: true });
});

router.get('/admin/session', (req, res) => {
  res.json({ authenticated: isAdminTokenValid(getCookie(req, 'admin_session')) });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.status(204).end();
});

router.get('/admin/bookings', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const bookings = await listBookings();
  res.json({ bookings });
});

router.patch('/admin/bookings/:id/cancel', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = cancellationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please provide a cancellation reason between 5 and 500 characters.' });
  const booking = await cancelBooking(String(req.params.id), parsed.data.reason);
  if (!booking) return res.status(404).json({ message: 'Active booking not found.' });

  let emailSent = true;
  try {
    await sendBookingCancellation(booking, parsed.data.reason);
  } catch (error) {
    emailSent = false;
    console.error('Failed to send cancellation email', error);
  }
  res.json({ booking, emailSent });
});

router.get('/admin/availability', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const date = String(req.query.date || '');
  if (!date) return res.status(400).json({ message: 'Date is required.' });
  res.json({ slots: await getAvailability(date) });
});

router.patch('/admin/availability', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = availabilityUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Valid date, time, and blocked status are required.' });
  const { date, time, blocked } = parsed.data;
  if (!(await setTimeBlocked(date, time, blocked))) return res.status(400).json({ message: 'Invalid time.' });
  res.json({ slots: await getAvailability(date) });
});

export default router;
