export const serviceCatalog = [
  { title: 'Exterior Refresh', durationMinutes: 120 },
  { title: 'Interior Refresh', durationMinutes: 120 },
  { title: 'Complete Refresh', durationMinutes: 180 },
] as const;

export const businessOpenMinutes = 8 * 60;
export const businessCloseMinutes = 20 * 60;
export const businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'America/Chicago';
export const defaultTimes = Array.from(
  { length: 13 },
  (_, index) => `${String(index + 8).padStart(2, '0')}:00`,
);

export function getService(service: string) {
  return serviceCatalog.find((item) => item.title === service);
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getBusinessDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isPastBusinessDate(date: string) {
  return date < getBusinessDate();
}
