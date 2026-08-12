"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authService_1 = require("./authService");
const bookingService_1 = require("./bookingService");
const emailService_1 = require("./emailService");
const router = express_1.default.Router();
router.get('/available-times', async (req, res) => {
    const date = String(req.query.date || '');
    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required.' });
    }
    const bookings = await (0, bookingService_1.listBookings)();
    const availableTimes = (0, bookingService_1.getAvailableTimes)(date, bookings);
    res.json({ availableTimes });
});
router.get('/services', (_req, res) => {
    res.json({ services: (0, bookingService_1.getSupportedServices)(), defaultTimes: (0, bookingService_1.getDefaultTimes)() });
});
router.post('/bookings', async (req, res) => {
    const { name, email, service, date, time, notes, addressLine1, addressLine2, city, state, zip, address } = req.body;
    if (!name || !email || !service || !date || !time) {
        return res.status(400).json({ message: 'Missing required booking fields.' });
    }
    const booking = await (0, bookingService_1.createBooking)({ name, email, service, date, time, notes, addressLine1, addressLine2, city, state, zip, address });
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
router.post('/admin/login', (req, res) => {
    const password = String(req.body.password || '');
    const ip = (0, authService_1.getIp)(req);
    if (!(0, authService_1.canAttemptLogin)(ip)) {
        return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    if (password !== (0, authService_1.getAdminPassword)()) {
        (0, authService_1.recordLoginAttempt)(ip);
        return res.status(401).json({ message: 'Invalid admin password.' });
    }
    const token = (0, authService_1.createAdminToken)();
    res.json({ token });
});
router.get('/admin/bookings', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!(0, authService_1.isAdminTokenValid)(token)) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    const bookings = await (0, bookingService_1.listBookings)();
    res.json({ bookings });
});
exports.default = router;
