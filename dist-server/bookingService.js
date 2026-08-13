"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedServices = getSupportedServices;
exports.getDefaultTimes = getDefaultTimes;
exports.getAvailableTimes = getAvailableTimes;
exports.getAvailability = getAvailability;
exports.setTimeBlocked = setTimeBlocked;
exports.listBookings = listBookings;
exports.createBooking = createBooking;
exports.cancelBooking = cancelBooking;
const crypto_1 = __importDefault(require("crypto"));
const storage_1 = require("./storage");
const serviceCatalog_1 = require("./serviceCatalog");
function getSupportedServices() {
    return serviceCatalog_1.serviceCatalog;
}
function getDefaultTimes() {
    return serviceCatalog_1.defaultTimes;
}
async function getAvailableTimes(date, serviceName, bookings) {
    if ((0, serviceCatalog_1.isPastBusinessDate)(date))
        return [];
    const service = (0, serviceCatalog_1.getService)(serviceName);
    if (!service)
        return [];
    const allBookings = bookings ?? await (0, storage_1.readBookings)();
    const dateBookings = allBookings.filter((booking) => booking.date === date && booking.status === 'confirmed');
    const blockedTimes = await (0, storage_1.readBlockedTimesForDate)(date);
    return serviceCatalog_1.defaultTimes.filter((time) => {
        const start = (0, serviceCatalog_1.timeToMinutes)(time);
        const end = start + service.durationMinutes;
        if (end > serviceCatalog_1.businessCloseMinutes)
            return false;
        const overlapsBooking = dateBookings.some((booking) => {
            const bookedStart = (0, serviceCatalog_1.timeToMinutes)(booking.time);
            return start < bookedStart + booking.durationMinutes && end > bookedStart;
        });
        const overlapsBlocked = blockedTimes.some((blockedTime) => {
            const blockedStart = (0, serviceCatalog_1.timeToMinutes)(blockedTime);
            return start < blockedStart + 60 && end > blockedStart;
        });
        return !overlapsBooking && !overlapsBlocked;
    });
}
async function getAvailability(date) {
    const bookings = await (0, storage_1.readBookings)();
    const blockedTimes = await (0, storage_1.readBlockedTimesForDate)(date);
    const dateBookings = bookings.filter((booking) => booking.date === date && booking.status === 'confirmed');
    return serviceCatalog_1.defaultTimes.map((time) => ({
        time,
        status: dateBookings.some((booking) => {
            const slotStart = (0, serviceCatalog_1.timeToMinutes)(time);
            const bookedStart = (0, serviceCatalog_1.timeToMinutes)(booking.time);
            return slotStart < bookedStart + booking.durationMinutes && slotStart + 60 > bookedStart;
        }) ? 'booked' : blockedTimes.includes(time) ? 'blocked' : 'available',
    }));
}
async function setTimeBlocked(date, time, blocked) {
    if (!serviceCatalog_1.defaultTimes.includes(time))
        return false;
    await (0, storage_1.setBlockedTime)(date, time, blocked);
    return true;
}
async function listBookings() {
    return (0, storage_1.readBookings)();
}
async function createBooking(payload) {
    if ((0, serviceCatalog_1.isPastBusinessDate)(payload.date))
        return null;
    const service = (0, serviceCatalog_1.getService)(payload.service);
    if (!service)
        return null;
    const bookings = await (0, storage_1.readBookings)();
    const availableTimes = await getAvailableTimes(payload.date, payload.service, bookings);
    if (!availableTimes.includes(payload.time)) {
        return null;
    }
    const booking = {
        id: crypto_1.default.randomUUID(),
        ...payload,
        durationMinutes: service.durationMinutes,
        transportService: Boolean(payload.transportService),
        status: 'confirmed',
    };
    return (await (0, storage_1.createBookingRecord)(booking)) ? booking : null;
}
async function cancelBooking(id, reason) {
    return (0, storage_1.cancelBookingRecord)(id, reason);
}
