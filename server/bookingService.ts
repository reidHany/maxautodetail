import crypto from 'crypto';
import { Booking, BookingPayload } from './types';
import { cancelBookingRecord, createBookingRecord, readBlockedTimesForDate, readBookings, setBlockedTime } from './storage';
import { businessCloseMinutes, defaultTimes, getService, isPastBusinessDate, serviceCatalog, timeToMinutes } from './serviceCatalog';

export function getSupportedServices() {
  return serviceCatalog;
}

export function getDefaultTimes() {
  return defaultTimes;
}

export async function getAvailableTimes(date: string, serviceName: string, bookings?: Booking[]) {
  if (isPastBusinessDate(date)) return [];
  const service = getService(serviceName);
  if (!service) return [];
  const allBookings = bookings ?? await readBookings();
  const dateBookings = allBookings.filter((booking) => booking.date === date && booking.status === 'confirmed');
  const blockedTimes = await readBlockedTimesForDate(date);
  return defaultTimes.filter((time) => {
    const start = timeToMinutes(time);
    const end = start + service.durationMinutes;
    if (end > businessCloseMinutes) return false;
    const overlapsBooking = dateBookings.some((booking) => {
      const bookedStart = timeToMinutes(booking.time);
      return start < bookedStart + booking.durationMinutes && end > bookedStart;
    });
    const overlapsBlocked = blockedTimes.some((blockedTime) => {
      const blockedStart = timeToMinutes(blockedTime);
      return start < blockedStart + 60 && end > blockedStart;
    });
    return !overlapsBooking && !overlapsBlocked;
  });
}

export async function getAvailability(date: string) {
  const bookings = await readBookings();
  const blockedTimes = await readBlockedTimesForDate(date);
  const dateBookings = bookings.filter((booking) => booking.date === date && booking.status === 'confirmed');
  return defaultTimes.map((time) => ({
    time,
    status: dateBookings.some((booking) => {
      const slotStart = timeToMinutes(time);
      const bookedStart = timeToMinutes(booking.time);
      return slotStart < bookedStart + booking.durationMinutes && slotStart + 60 > bookedStart;
    }) ? 'booked' : blockedTimes.includes(time) ? 'blocked' : 'available',
  }));
}

export async function setTimeBlocked(date: string, time: string, blocked: boolean) {
  if (!defaultTimes.includes(time)) return false;
  await setBlockedTime(date, time, blocked);
  return true;
}

export async function listBookings() {
  return readBookings();
}

export async function createBooking(payload: BookingPayload) {
  if (isPastBusinessDate(payload.date)) return null;
  const service = getService(payload.service);
  if (!service) return null;
  const bookings = await readBookings();
  const availableTimes = await getAvailableTimes(payload.date, payload.service, bookings);
  if (!availableTimes.includes(payload.time)) {
    return null;
  }

  const booking: Booking = {
    id: crypto.randomUUID(),
    ...payload,
    durationMinutes: service.durationMinutes,
    transportService: Boolean(payload.transportService),
    status: 'confirmed',
  };

  return (await createBookingRecord(booking)) ? booking : null;
}

export async function cancelBooking(id: string, reason: string) {
  return cancelBookingRecord(id, reason);
}
