"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingConfirmation = sendBookingConfirmation;
exports.sendBookingCancellation = sendBookingCancellation;
require("dotenv/config");
const resend_1 = require("resend");
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'reid.hany@gmail.com';
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'America/Chicago';
const resend = new resend_1.Resend(RESEND_API_KEY);
async function sendBookingConfirmation(booking) {
    if (!RESEND_API_KEY) {
        throw new Error('Resend is not configured. Set RESEND_API_KEY.');
    }
    const addressLines = [];
    if (booking.addressLine1)
        addressLines.push(booking.addressLine1);
    if (booking.addressLine2)
        addressLines.push(booking.addressLine2);
    const cityStateZip = [booking.city, booking.state, booking.zip].filter(Boolean).join(' ');
    if (cityStateZip)
        addressLines.push(cityStateZip);
    const address = addressLines.join('\n');
    const safeName = escapeHtml(booking.name);
    const safeService = escapeHtml(booking.service);
    const safeAddress = escapeHtml(address).replace(/\n/g, '<br/>');
    const safeNotes = booking.notes ? escapeHtml(booking.notes).replace(/\n/g, '<br/>') : '';
    const transportLabel = booking.transportService
        ? 'Yes — vehicle pickup and return requested'
        : 'No';
    const customerSubject = `Booking confirmation — ${booking.service} on ${booking.date} at ${booking.time}`;
    const customerHtml = `
    <p>Hi ${safeName},</p>
    <p>Thanks for booking <strong>${safeService}</strong> with Stanbrough Sparkle.</p>
    <p><strong>Date:</strong> ${booking.date}<br/>
    <strong>Time:</strong> ${booking.time}</p>
    <p><strong>Vehicle pickup &amp; return:</strong> ${transportLabel}</p>
    <p><strong>Address:</strong><br/>${safeAddress}</p>
    ${booking.transportService ? '<p>We’ll pick up your vehicle from this address and return it after the detail is complete.</p>' : ''}
    ${safeNotes ? `<p><strong>Notes:</strong><br/>${safeNotes}</p>` : ''}
    <p>You can add this appointment to your calendar using the link in your booking confirmation page.</p>
    <p>Thanks,<br/>Stanbrough Sparkle</p>
  `;
    const businessSubject = `New booking: ${booking.service} — ${booking.date} ${booking.time}`;
    const businessHtml = `
    <p>New booking received:</p>
    <ul>
      <li><strong>Name:</strong> ${safeName}</li>
      <li><strong>Email:</strong> ${escapeHtml(booking.email)}</li>
      <li><strong>Service:</strong> ${safeService}</li>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Vehicle pickup &amp; return:</strong> ${transportLabel}</li>
      <li><strong>Address:</strong><br/>${safeAddress}</li>
      ${safeNotes ? `<li><strong>Notes:</strong><br/>${safeNotes}</li>` : ''}
    </ul>
  `;
    // build calendar data (UTC)
    const [year, month, day] = booking.date.split('-').map(Number);
    const [hours, minutes] = booking.time.split(':').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    const end = new Date(start.getTime() + booking.durationMinutes * 60 * 1000);
    const toUtcIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const toLocalIcsDate = (date) => date.toISOString().slice(0, 19).replace(/[-:]/g, '');
    const calendarDetails = `Transport service: ${transportLabel}\n${booking.notes || ''}\nCustomer: ${booking.name} <${booking.email}>`;
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Stanbrough Sparkle//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:${booking.id}@stanbrough.sparkle\r\nDTSTAMP:${toUtcIcsDate(new Date())}\r\nDTSTART;TZID=${BUSINESS_TIME_ZONE}:${toLocalIcsDate(start)}\r\nDTEND;TZID=${BUSINESS_TIME_ZONE}:${toLocalIcsDate(end)}\r\nSUMMARY:${escapeIcs(booking.service)}\r\nDESCRIPTION:${escapeIcs(calendarDetails)}\r\nLOCATION:${escapeIcs(formatAddressForIcs(booking))}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const googleCalendarUrl = buildGoogleCalendarUrl({
        title: booking.service,
        details: calendarDetails,
        location: formatAddressForIcs(booking),
        start,
        end,
    });
    // send both emails in parallel
    const calendarAttachment = {
        filename: 'booking.ics',
        content: Buffer.from(ics).toString('base64'),
    };
    const customerMsg = {
        to: [booking.email],
        from: SENDER_EMAIL,
        replyTo: BUSINESS_EMAIL,
        subject: customerSubject,
        html: customerHtml + `<p><a href="${googleCalendarUrl}">Add to Google Calendar</a></p>`,
        attachments: [calendarAttachment],
    };
    const businessMsg = {
        to: [BUSINESS_EMAIL],
        from: SENDER_EMAIL,
        replyTo: booking.email,
        subject: businessSubject,
        html: businessHtml + `<p><a href="${googleCalendarUrl}">Add to Google Calendar</a></p>`,
        attachments: [calendarAttachment],
    };
    const results = await Promise.all([
        resend.emails.send(customerMsg),
        resend.emails.send(businessMsg),
    ]);
    const failure = results.find((result) => result.error);
    if (failure?.error) {
        throw new Error(`Resend email failed: ${failure.error.message}`);
    }
}
function escapeIcs(s) {
    if (!s)
        return '';
    return String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
async function sendBookingCancellation(booking, reason) {
    if (!RESEND_API_KEY)
        throw new Error('Resend is not configured. Set RESEND_API_KEY.');
    const safeName = escapeHtml(booking.name);
    const safeService = escapeHtml(booking.service);
    const safeReason = escapeHtml(reason).replace(/\n/g, '<br/>');
    const result = await resend.emails.send({
        from: SENDER_EMAIL,
        to: [booking.email],
        replyTo: BUSINESS_EMAIL,
        subject: `Your ${booking.service} booking has been cancelled`,
        html: `
      <p>Hi ${safeName},</p>
      <p>Your <strong>${safeService}</strong> appointment scheduled for
      <strong>${booking.date} at ${booking.time}</strong> has been cancelled.</p>
      <p><strong>Reason:</strong><br/>${safeReason}</p>
      <p>If you have questions or would like to choose another time, reply to this email or book a new appointment on our website.</p>
      <p>We’re sorry for the inconvenience.<br/>Stanbrough Sparkle</p>
    `,
    });
    if (result.error)
        throw new Error(`Resend cancellation email failed: ${result.error.message}`);
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character] || character);
}
function formatAddressForIcs(b) {
    const parts = [];
    if (b.addressLine1)
        parts.push(b.addressLine1);
    if (b.addressLine2)
        parts.push(b.addressLine2);
    const cityStateZip = [b.city, b.state, b.zip].filter(Boolean).join(' ');
    if (cityStateZip)
        parts.push(cityStateZip);
    return parts.join(', ');
}
function buildGoogleCalendarUrl(opts) {
    const fmt = (d) => d.toISOString().slice(0, 19).replace(/[-:]/g, '');
    const dates = `${fmt(opts.start)}/${fmt(opts.end)}`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: opts.title,
        details: opts.details || '',
        location: opts.location || '',
        dates,
        ctz: BUSINESS_TIME_ZONE,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
}
