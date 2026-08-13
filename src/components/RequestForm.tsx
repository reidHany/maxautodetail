import { FormEvent, useEffect, useMemo, useState } from 'react';

export interface Booking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  transportService?: boolean;
  notes?: string;
  googleCalendarUrl: string;
  icsUrl: string;
}

interface BookingFormProps {
  onSubmit: (booking: Booking) => void;
}

const services = [
  { title: 'Exterior Refresh', durationMinutes: 120 },
  { title: 'Interior Refresh', durationMinutes: 120 },
  { title: 'Complete Refresh', durationMinutes: 180 },
];

const defaultTimes = Array.from({ length: 13 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
const minimumBookingDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function formatToAmPm(time24: string) {
  // time24 expected in HH:MM
  const [hh, mm] = time24.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour}:${mm.toString().padStart(2, '0')} ${period}`;
}

function formatGoogleDateTime(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildGoogleCalendarUrl(booking: Omit<Booking, 'id' | 'googleCalendarUrl' | 'icsUrl'>, endDate: Date) {
  const title = encodeURIComponent(`${booking.service} at Stanbrough Sparkle`);
  const details = encodeURIComponent(`Appointment for ${booking.name}\nAddress: ${booking.address || 'Stanbrough Sparkle'}\nNotes: ${booking.notes || 'None'}`);
  const dates = `${formatGoogleDateTime(new Date(`${booking.date}T${booking.time}:00`))}/${formatGoogleDateTime(endDate)}`;
  const location = encodeURIComponent(booking.address || 'Stanbrough Sparkle');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

function buildIcsContent(booking: Omit<Booking, 'id' | 'googleCalendarUrl' | 'icsUrl'>, endDate: Date) {
  const start = `${booking.date.replace(/-/g, '')}T${booking.time.replace(/:/g, '')}00`;
  const end = `${endDate.toISOString().slice(0, 19).replace(/[-:]/g, '')}`;
  const location = booking.address || 'Stanbrough Sparkle';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stanbrough Sparkle//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@stanbroughsparkle`,
    `DTSTAMP:${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${booking.service} - ${booking.name}`,
    `DESCRIPTION:Notes: ${booking.notes || 'None'}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function RequestForm({ onSubmit }: BookingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState(services[0].title);
  const [date, setDate] = useState(minimumBookingDate);
  const [time, setTime] = useState(defaultTimes[0]);
  // manual address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [availableTimes, setAvailableTimes] = useState<string[]>(defaultTimes);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function fetchAvailability() {
      try {
        const params = new URLSearchParams({ date, service });
        const response = await fetch(`/api/available-times?${params}`, { signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setAvailableTimes([]);
          setStatus(body?.message || 'Unable to load available times.');
          return;
        }
        const data = await response.json();
        setAvailableTimes(data.availableTimes);
        setTime((current) => data.availableTimes.includes(current) ? current : (data.availableTimes[0] ?? ''));
        setStatus(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAvailableTimes([]);
        setStatus('Unable to connect to the scheduling server.');
      }
    }

    fetchAvailability();
    return () => controller.abort();
  }, [date, service]);

  const selectedService = useMemo(
    () => services.find((item) => item.title === service) ?? services[0],
    [service],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!time) {
      setStatus('Please choose an available time slot.');
      return;
    }
    if (date < minimumBookingDate) {
      setStatus('Please choose today or a future date.');
      return;
    }
    // validate manual address fields
    if (!addressLine1 || !city || !stateVal || !zip) {
      setStatus('Please complete the address: street, city, state, and ZIP.');
      return;
    }

    const bookingPayload = {
      name,
      email,
      service,
      date,
      time,
      address: `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${stateVal} ${zip}`,
      addressLine1,
      addressLine2,
      city,
      state: stateVal,
      zip,
      notes,
    };

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload),
    });

    if (!response.ok) {
      setStatus('That time slot is no longer available. Please select another time.');
      return;
    }

    const savedBooking = await response.json();
    const eventStart = new Date(`${date}T${time}:00`);
    const endDate = new Date(eventStart.getTime() + selectedService.durationMinutes * 60000);
    const googleCalendarUrl = buildGoogleCalendarUrl(bookingPayload, endDate);
    const icsContent = buildIcsContent(bookingPayload, endDate);
    const icsBlob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const icsUrl = URL.createObjectURL(icsBlob);

    setName('');
    setEmail('');
    setService(services[0].title);
    setDate(minimumBookingDate);
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setStateVal('');
    setZip('');
    setNotes('');

    onSubmit({
      id: savedBooking.id,
      name: bookingPayload.name,
      email: bookingPayload.email,
      service: bookingPayload.service,
      date: bookingPayload.date,
      time: bookingPayload.time,
      address: bookingPayload.address,
      notes: bookingPayload.notes,
      googleCalendarUrl,
      icsUrl,
    });
  };

  return (
    <section className="request-section">
      <h2>Book a Detailing Appointment</h2>
      <form onSubmit={handleSubmit} className="request-form">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Service
          <select value={service} onChange={(event) => setService(event.target.value)}>
            {services.map((item) => (
              <option key={item.title}>{item.title}</option>
            ))}
          </select>
        </label>
        <label>
          Choose a date
          <input type="date" min={minimumBookingDate} value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>
          Available times
          <select value={time} onChange={(event) => setTime(event.target.value)} required>
            {availableTimes.length > 0 ? (
              availableTimes.map((slot) => (
                <option key={slot} value={slot}>
                  {formatToAmPm(slot)}
                </option>
              ))
            ) : (
              <option value="">No available times for this date</option>
            )}
          </select>
        </label>
        <label>
          Address line 1
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
        </label>
        <label>
          Address line 2 (optional)
          <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
        </label>
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label>
          State
          <select value={stateVal} onChange={(e) => setStateVal(e.target.value)} required>
            <option value="">Select state</option>
            <option value="IA">Iowa (IA)</option>
            <option value="MN">Minnesota (MN)</option>
            <option value="NE">Nebraska (NE)</option>
            <option value="SD">South Dakota (SD)</option>
          </select>
        </label>
        <label>
          ZIP
          <input value={zip} onChange={(e) => setZip(e.target.value)} required />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </label>
        <button type="submit" disabled={availableTimes.length === 0}>
          Confirm Booking
        </button>
        {status && <p className="form-status">{status}</p>}
      </form>
    </section>
  );
}
