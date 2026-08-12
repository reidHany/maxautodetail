import { FormEvent, useEffect, useMemo, useState } from 'react';

export interface Booking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  // structured address fields
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  googleCalendarUrl: string;
  icsUrl: string;
}

interface BookingFormProps {
  onSubmit: (booking: Booking) => void;
}

const services = [
  { title: 'Exterior Detail', durationMinutes: 120 },
  { title: 'Interior Detail', durationMinutes: 120 },
  { title: 'Ceramic Coating', durationMinutes: 180 },
];

const defaultTimes = ['09:00', '11:00', '13:00', '15:00', '17:00'];

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
  const title = encodeURIComponent(`${booking.service} at StanBrough Sparkle`);
  const details = encodeURIComponent(`Appointment for ${booking.name}\nAddress: ${booking.address || 'StanBrough Sparkle'}\nNotes: ${booking.notes || 'None'}`);
  const dates = `${formatGoogleDateTime(new Date(`${booking.date}T${booking.time}:00`))}/${formatGoogleDateTime(endDate)}`;
  const location = encodeURIComponent(booking.address || 'StanBrough Sparkle');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

function buildIcsContent(booking: Omit<Booking, 'id' | 'googleCalendarUrl' | 'icsUrl'>, endDate: Date) {
  const start = `${booking.date.replace(/-/g, '')}T${booking.time.replace(/:/g, '')}00`;
  const end = `${endDate.toISOString().slice(0, 19).replace(/[-:]/g, '')}`;
  const location = booking.address || 'StanBrough Sparkle';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StanBrough Sparkle//EN',
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    async function fetchAvailability() {
      const response = await fetch(`/api/available-times?date=${encodeURIComponent(date)}`);
      if (!response.ok) {
        setAvailableTimes([]);
        return;
      }
      const data = await response.json();
      setAvailableTimes(data.availableTimes);
      if (!data.availableTimes.includes(time)) {
        setTime(data.availableTimes[0] ?? '');
      }
    }

    fetchAvailability();
  }, [date, time]);

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
    setDate(new Date().toISOString().slice(0, 10));
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
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
            <option value="AL">Alabama (AL)</option>
            <option value="AK">Alaska (AK)</option>
            <option value="AZ">Arizona (AZ)</option>
            <option value="AR">Arkansas (AR)</option>
            <option value="CA">California (CA)</option>
            <option value="CO">Colorado (CO)</option>
            <option value="CT">Connecticut (CT)</option>
            <option value="DE">Delaware (DE)</option>
            <option value="DC">District of Columbia (DC)</option>
            <option value="FL">Florida (FL)</option>
            <option value="GA">Georgia (GA)</option>
            <option value="HI">Hawaii (HI)</option>
            <option value="ID">Idaho (ID)</option>
            <option value="IL">Illinois (IL)</option>
            <option value="IN">Indiana (IN)</option>
            <option value="IA">Iowa (IA)</option>
            <option value="KS">Kansas (KS)</option>
            <option value="KY">Kentucky (KY)</option>
            <option value="LA">Louisiana (LA)</option>
            <option value="ME">Maine (ME)</option>
            <option value="MD">Maryland (MD)</option>
            <option value="MA">Massachusetts (MA)</option>
            <option value="MI">Michigan (MI)</option>
            <option value="MN">Minnesota (MN)</option>
            <option value="MS">Mississippi (MS)</option>
            <option value="MO">Missouri (MO)</option>
            <option value="MT">Montana (MT)</option>
            <option value="NE">Nebraska (NE)</option>
            <option value="NV">Nevada (NV)</option>
            <option value="NH">New Hampshire (NH)</option>
            <option value="NJ">New Jersey (NJ)</option>
            <option value="NM">New Mexico (NM)</option>
            <option value="NY">New York (NY)</option>
            <option value="NC">North Carolina (NC)</option>
            <option value="ND">North Dakota (ND)</option>
            <option value="OH">Ohio (OH)</option>
            <option value="OK">Oklahoma (OK)</option>
            <option value="OR">Oregon (OR)</option>
            <option value="PA">Pennsylvania (PA)</option>
            <option value="RI">Rhode Island (RI)</option>
            <option value="SC">South Carolina (SC)</option>
            <option value="SD">South Dakota (SD)</option>
            <option value="TN">Tennessee (TN)</option>
            <option value="TX">Texas (TX)</option>
            <option value="UT">Utah (UT)</option>
            <option value="VT">Vermont (VT)</option>
            <option value="VA">Virginia (VA)</option>
            <option value="WA">Washington (WA)</option>
            <option value="WV">West Virginia (WV)</option>
            <option value="WI">Wisconsin (WI)</option>
            <option value="WY">Wyoming (WY)</option>
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
