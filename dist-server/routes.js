"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const express_rate_limit_1 = require("express-rate-limit");
const authService_1 = require("./authService");
const bookingService_1 = require("./bookingService");
const emailService_1 = require("./emailService");
const serviceCatalog_1 = require("./serviceCatalog");
const router = express_1.default.Router();
const bookingLimiter = (0, express_rate_limit_1.rateLimit)({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const loginLimiter = (0, express_rate_limit_1.rateLimit)({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
function getCookie(req, name) {
    const cookies = req.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
    const cookie = cookies.find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}
function requireAdmin(req, res) {
    if (!(0, authService_1.isAdminTokenValid)(getCookie(req, 'admin_session'))) {
        res.status(401).json({ message: 'Unauthorized.' });
        return false;
    }
    return true;
}
const dateSchema = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => !(0, serviceCatalog_1.isPastBusinessDate)(date), 'Date cannot be in the past.');
const bookingSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100),
    email: zod_1.z.string().trim().email().max(254),
    service: zod_1.z.string().trim().max(80),
    date: dateSchema,
    time: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    address: zod_1.z.string().trim().min(5).max(300),
    addressLine1: zod_1.z.string().trim().min(3).max(120),
    addressLine2: zod_1.z.string().trim().max(120).optional().or(zod_1.z.literal('')),
    city: zod_1.z.string().trim().min(2).max(80),
    state: zod_1.z.string().regex(/^[A-Z]{2}$/),
    zip: zod_1.z.string().regex(/^\d{5}(?:-\d{4})?$/),
    transportService: zod_1.z.boolean().optional().default(false),
    notes: zod_1.z.string().trim().max(1000).optional().or(zod_1.z.literal('')),
}).strict().refine((booking) => (0, bookingService_1.getSupportedServices)().some((service) => service.title === booking.service), {
    message: 'Unsupported service.', path: ['service'],
});
const availabilityUpdateSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    blocked: zod_1.z.boolean(),
}).strict();
const cancellationSchema = zod_1.z.object({ reason: zod_1.z.string().trim().min(5).max(500) }).strict();
router.get('/available-times', async (req, res) => {
    const date = String(req.query.date || '');
    const service = String(req.query.service || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !service)
        return res.status(400).json({ message: 'Valid date and service are required.' });
    if ((0, serviceCatalog_1.isPastBusinessDate)(date))
        return res.status(400).json({ message: 'Past dates cannot be booked.' });
    const bookings = await (0, bookingService_1.listBookings)();
    const availableTimes = await (0, bookingService_1.getAvailableTimes)(date, service, bookings);
    res.json({ availableTimes });
});
router.get('/services', (_req, res) => {
    res.json({ services: (0, bookingService_1.getSupportedServices)(), defaultTimes: (0, bookingService_1.getDefaultTimes)(), minimumDate: (0, serviceCatalog_1.getBusinessDate)() });
});
router.post('/bookings', bookingLimiter, async (req, res) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid booking details.' });
    const booking = await (0, bookingService_1.createBooking)(parsed.data);
    if (!booking) {
        return res.status(409).json({ message: 'Selected time is no longer available.' });
    }
    // attempt to send confirmation email (best-effort)
    try {
        await (0, emailService_1.sendBookingConfirmation)(booking);
    }
    catch (err) {
        // log but don't fail the booking
        // eslint-disable-next-line no-console
        console.error('Failed to send booking confirmation', err);
    }
    res.status(201).json({ id: booking.id });
});
router.post('/admin/login', loginLimiter, (req, res) => {
    const password = String(req.body.password || '');
    const ip = (0, authService_1.getIp)(req);
    if (!(0, authService_1.canAttemptLogin)(ip)) {
        return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    if (!(0, authService_1.isAdminPasswordValid)(password)) {
        (0, authService_1.recordLoginAttempt)(ip);
        return res.status(401).json({ message: 'Invalid admin password.' });
    }
    const token = (0, authService_1.createAdminToken)();
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
    res.json({ authenticated: (0, authService_1.isAdminTokenValid)(getCookie(req, 'admin_session')) });
});
router.post('/admin/logout', (req, res) => {
    res.clearCookie('admin_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    res.status(204).end();
});
router.get('/admin/bookings', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const bookings = await (0, bookingService_1.listBookings)();
    res.json({ bookings });
});
router.patch('/admin/bookings/:id/cancel', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const parsed = cancellationSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Please provide a cancellation reason between 5 and 500 characters.' });
    const booking = await (0, bookingService_1.cancelBooking)(String(req.params.id), parsed.data.reason);
    if (!booking)
        return res.status(404).json({ message: 'Active booking not found.' });
    let emailSent = true;
    try {
        await (0, emailService_1.sendBookingCancellation)(booking, parsed.data.reason);
    }
    catch (error) {
        emailSent = false;
        console.error('Failed to send cancellation email', error);
    }
    res.json({ booking, emailSent });
});
router.get('/admin/availability', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const date = String(req.query.date || '');
    if (!date)
        return res.status(400).json({ message: 'Date is required.' });
    res.json({ slots: await (0, bookingService_1.getAvailability)(date) });
});
router.patch('/admin/availability', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const parsed = availabilityUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Valid date, time, and blocked status are required.' });
    const { date, time, blocked } = parsed.data;
    if (!(await (0, bookingService_1.setTimeBlocked)(date, time, blocked)))
        return res.status(400).json({ message: 'Invalid time.' });
    res.json({ slots: await (0, bookingService_1.getAvailability)(date) });
});
exports.default = router;
