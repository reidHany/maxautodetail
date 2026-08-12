"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedServices = getSupportedServices;
exports.getDefaultTimes = getDefaultTimes;
exports.getAvailableTimes = getAvailableTimes;
exports.listBookings = listBookings;
exports.createBooking = createBooking;
const crypto_1 = __importDefault(require("crypto"));
const storage_1 = require("./storage");
const defaultTimes = ['09:00', '11:00', '13:00', '15:00', '17:00'];
const services = ['Exterior Detail', 'Interior Detail', 'Ceramic Coating'];
function getSupportedServices() {
    return services;
}
function getDefaultTimes() {
    return defaultTimes;
}
function getAvailableTimes(date, bookings) {
    const bookedTimes = bookings.filter((booking) => booking.date === date).map((booking) => booking.time);
    return defaultTimes.filter((time) => !bookedTimes.includes(time));
}
async function listBookings() {
    return (0, storage_1.readBookings)();
}
async function createBooking(payload) {
    const bookings = await (0, storage_1.readBookings)();
    const availableTimes = getAvailableTimes(payload.date, bookings);
    if (!availableTimes.includes(payload.time)) {
        return null;
    }
    const booking = {
        id: crypto_1.default.randomUUID(),
        ...payload,
    };
    bookings.push(booking);
    await (0, storage_1.writeBookings)(bookings);
    return booking;
}
