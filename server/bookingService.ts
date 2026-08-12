import crypto from 'crypto';
import { Booking, BookingPayload } from './types';
import { readBookings, writeBookings } from './storage';

const defaultTimes = ['09:00', '11:00', '13:00', '15:00', '17:00'];
const services = ['Exterior Detail', 'Interior Detail', 'Ceramic Coating'];

export function getSupportedServices() {
  return services;
}

export function getDefaultTimes() {
  return defaultTimes;
}

export function getAvailableTimes(date: string, bookings: Booking[]) {
  const bookedTimes = bookings.filter((booking) => booking.date === date).map((booking) => booking.time);
  return defaultTimes.filter((time) => !bookedTimes.includes(time));
}

export async function listBookings() {
  return readBookings();
}

export async function createBooking(payload: BookingPayload) {
  const bookings = await readBookings();
  const availableTimes = getAvailableTimes(payload.date, bookings);
  if (!availableTimes.includes(payload.time)) {
    return null;
  }

  const booking: Booking = {
    id: crypto.randomUUID(),
    ...payload,
  };

  bookings.push(booking);
  await writeBookings(bookings);
  return booking;
}
