import { Booking } from './RequestForm';

interface BookingSuccessProps {
  booking: Booking;
  onBackHome: () => void;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function BookingSuccess({ booking, onBackHome }: BookingSuccessProps) {
  return (
    <main className="booking-success">
      <div className="success-orbit" aria-hidden="true"><span>✓</span></div>
      <p className="eyebrow">Booking confirmed</p>
      <h1>Success! We’ve got your booking.</h1>
      <p className="success-lead">
        Check <strong>{booking.email}</strong> for your confirmation and appointment details.
      </p>

      <section className="success-summary" aria-label="Booking summary">
        <div><span>Service</span><strong>{booking.service}</strong></div>
        <div><span>Date</span><strong>{formatDate(booking.date)}</strong></div>
        <div><span>Time</span><strong>{formatTime(booking.time)}</strong></div>
        <div><span>Pickup &amp; return</span><strong>{booking.transportService ? 'Included' : 'Not requested'}</strong></div>
      </section>

      {booking.transportService && (
        <p className="success-note">We’ll collect your vehicle from the booking address and return it once the detail is complete.</p>
      )}

      <div className="success-actions">
        <button className="button success-home" type="button" onClick={onBackHome}>Back to home</button>
        <a className="success-calendar" href={booking.googleCalendarUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a>
        <a className="success-calendar" href={booking.icsUrl} download="stanbrough-sparkle-booking.ics">Download calendar event</a>
      </div>
    </main>
  );
}
