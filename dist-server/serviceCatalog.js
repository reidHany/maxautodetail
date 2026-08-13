"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTimes = exports.businessTimeZone = exports.businessCloseMinutes = exports.businessOpenMinutes = exports.serviceCatalog = void 0;
exports.getService = getService;
exports.timeToMinutes = timeToMinutes;
exports.getBusinessDate = getBusinessDate;
exports.isPastBusinessDate = isPastBusinessDate;
exports.serviceCatalog = [
    { title: 'Exterior Refresh', durationMinutes: 120 },
    { title: 'Interior Refresh', durationMinutes: 120 },
    { title: 'Complete Refresh', durationMinutes: 180 },
];
exports.businessOpenMinutes = 8 * 60;
exports.businessCloseMinutes = 20 * 60;
exports.businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'America/Chicago';
exports.defaultTimes = Array.from({ length: 13 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
function getService(service) {
    return exports.serviceCatalog.find((item) => item.title === service);
}
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
function getBusinessDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: exports.businessTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}
function isPastBusinessDate(date) {
    return date < getBusinessDate();
}
