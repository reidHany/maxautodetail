"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingConfirmation = sendBookingConfirmation;
const mail_1 = __importDefault(require("@sendgrid/mail"));
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
// business notification recipient (defaults to the client email provided)
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'stanbrough.sparkle@gmail.com';
if (SENDGRID_API_KEY) {
    mail_1.default.setApiKey(SENDGRID_API_KEY);
}
async function sendBookingConfirmation(booking) {
    if (!SENDGRID_API_KEY || !SENDER_EMAIL) {
        throw new Error('SendGrid not configured');
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
    const customerSubject = `Booking confirmation — ${booking.service} on ${booking.date} at ${booking.time}`;
    const customerHtml = `
    <p>Hi ${booking.name},</p>
    <p>Thanks for booking <strong>${booking.service}</strong> with StanBrough Sparkle.</p>
    <p><strong>Date:</strong> ${booking.date}<br/>
    <strong>Time:</strong> ${booking.time}</p>
    <p><strong>Address:</strong><br/>${address.replace(/\n/g, '<br/>')}</p>
    ${booking.notes ? `<p><strong>Notes:</strong><br/>${booking.notes}</p>` : ''}
    <p>You can add this appointment to your calendar using the link in your booking confirmation page.</p>
    <p>Thanks,<br/>StanBrough Sparkle</p>
  `;
    const businessSubject = `New booking: ${booking.service} — ${booking.date} ${booking.time}`;
    const businessHtml = `
    <p>New booking received:</p>
    <ul>
      <li><strong>Name:</strong> ${booking.name}</li>
      <li><strong>Email:</strong> ${booking.email}</li>
      <li><strong>Service:</strong> ${booking.service}</li>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Address:</strong><br/>${address.replace(/\n/g, '<br/>')}</li>
      ${booking.notes ? `<li><strong>Notes:</strong><br/>${booking.notes}</li>` : ''}
    </ul>
  `;
    // build calendar data (UTC)
    const start = new Date(`${booking.date}T${booking.time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour
    function toIcsDate(d) {
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    }
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StanBrough Sparkle//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:${booking.id}@stanbrough.sparkle\r\nDTSTAMP:${toIcsDate(new Date())}\r\nDTSTART:${toIcsDate(start)}\r\nDTEND:${toIcsDate(end)}\r\nSUMMARY:${escapeIcs(booking.service)}\r\nDESCRIPTION:${escapeIcs((booking.notes || '') + `\\nCustomer: ${booking.name} <${booking.email}>`)}\r\nLOCATION:${escapeIcs(formatAddressForIcs(booking))}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const googleCalendarUrl = buildGoogleCalendarUrl({
        title: booking.service,
        details: (booking.notes || '') + `\nCustomer: ${booking.name} <${booking.email}>`,
        location: formatAddressForIcs(booking),
        start,
        end,
    });
    // send both emails in parallel
    const customerMsg = {
        to: booking.email,
        from: SENDER_EMAIL,
        subject: customerSubject,
        html: customerHtml,
    };
    const businessMsg = {
        to: BUSINESS_EMAIL,
        from: SENDER_EMAIL,
        subject: businessSubject,
        html: businessHtml + `<p><a href="${googleCalendarUrl}">Add to Google Calendar</a></p>`,
        attachments: [
            {
                content: Buffer.from(ics).toString('base64'),
                filename: 'booking.ics',
                type: 'text/calendar',
                disposition: 'attachment',
            },
        ],
    };
    // also attach ICS to customer email
    customerMsg.attachments = [
        {
            content: Buffer.from(ics).toString('base64'),
            filename: 'booking.ics',
            type: 'text/calendar',
            disposition: 'attachment',
        },
    ];
    // augment customer HTML with Google Calendar link
    customerMsg.html = customerHtml + `<p><a href="${googleCalendarUrl}">Add to Google Calendar</a></p>`;
    await Promise.all([mail_1.default.send(customerMsg), mail_1.default.send(businessMsg)]);
}
function escapeIcs(s) {
    if (!s)
        return '';
    return String(s).replace(/\\n/g, '\\n').replace(/,/g, '\\,');
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
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const dates = `${fmt(opts.start)}/${fmt(opts.end)}`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: opts.title,
        details: opts.details || '',
        location: opts.location || '',
        dates,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
}
