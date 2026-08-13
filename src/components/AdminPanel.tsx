import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  transportService?: boolean;
  notes?: string;
  status: 'confirmed' | 'cancelled';
  cancellationReason?: string;
}

interface AdminPanelProps {
  onLogout: () => void;
}

interface AvailabilitySlot {
  time: string;
  status: 'available' | 'booked' | 'blocked';
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [updatingTime, setUpdatingTime] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((response) => response.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    fetch('/api/admin/bookings')
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setStatus('Session expired. Please log in again.');
            handleLogout();
          } else {
            const body = await res.json().catch(() => null);
            setStatus(body?.message || 'Failed to load bookings.');
          }
          return;
        }
        const data = await res.json();
        setBookings(data.bookings ?? []);
      })
      .catch(() => setStatus('Network error while loading bookings.'));
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/admin/availability?date=${encodeURIComponent(selectedDate)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load availability.');
        const data = await response.json();
        setSlots(data.slots ?? []);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load availability.'));
  }, [authenticated, selectedDate]);

  const updateAvailability = async (slot: AvailabilitySlot) => {
    if (!authenticated || slot.status === 'booked') return;
    setUpdatingTime(slot.time);
    setStatus(null);
    try {
      const response = await fetch('/api/admin/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: slot.time, blocked: slot.status === 'available' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to update availability.');
      setSlots(data.slots ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update availability.');
    } finally {
      setUpdatingTime(null);
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (cancellationReason.trim().length < 5) {
      setStatus('Please provide a clear cancellation reason.');
      return;
    }
    setSubmittingCancellation(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to cancel booking.');
      setBookings((current) => current.map((item) => item.id === booking.id ? data.booking : item));
      setCancellingId(null);
      setCancellationReason('');
      setStatus(data.emailSent
        ? `Booking cancelled and ${booking.name} was notified by email.`
        : 'Booking cancelled, but the customer email could not be delivered. Please contact them manually.');
      if (booking.date === selectedDate) {
        const availabilityResponse = await fetch(`/api/admin/availability?date=${encodeURIComponent(selectedDate)}`);
        if (availabilityResponse.ok) setSlots((await availabilityResponse.json()).slots ?? []);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to cancel booking.');
    } finally {
      setSubmittingCancellation(false);
    }
  };

  const handleLogin = async () => {
    setStatus(null);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.message || 'Login failed.');
      return;
    }

    const data = await response.json();
    setAuthenticated(Boolean(data.authenticated));
    setPassword('');
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    onLogout();
  };

  return (
    <section className="request-section">
      <h2>Admin Dashboard</h2>
      {checkingSession ? (
        <p>Checking admin session…</p>
      ) : !authenticated ? (
        <div className="admin-login">
          <label>
            Admin password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <button type="button" onClick={handleLogin}>
            Log in
          </button>
          {status && <p className="form-status">{status}</p>}
        </div>
      ) : (
        <>
          <div className="admin-toolbar">
            <div><p className="eyebrow">Schedule control</p><h3>Manage availability</h3></div>
            <button className="button" type="button" onClick={handleLogout}>Logout</button>
          </div>

          <section className="availability-manager">
            <div className="availability-header">
              <div><h3>Daily availability</h3><p>Remove open times or restore blocked slots.</p></div>
              <label>Schedule date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            </div>
            <div className="availability-legend">
              <span><i className="available" /> Available</span>
              <span><i className="booked" /> Booked</span>
              <span><i className="blocked" /> Blocked</span>
            </div>
            <div className="time-slot-grid">
              {slots.map((slot) => (
                <div className={`admin-time-slot ${slot.status}`} key={slot.time}>
                  <span>{formatTime(slot.time)}</span>
                  {slot.status === 'booked' ? <small>Booked</small> : (
                    <button type="button" disabled={updatingTime === slot.time} onClick={() => updateAvailability(slot)}
                      aria-label={slot.status === 'available' ? `Remove ${formatTime(slot.time)}` : `Restore ${formatTime(slot.time)}`}
                      title={slot.status === 'available' ? 'Remove this time' : 'Restore this time'}>
                      {slot.status === 'available' ? '×' : '+'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {status && <p className="form-status">{status}</p>}

          <section className="admin-bookings">
            <div className="admin-section-heading"><h3>All bookings</h3><span>{bookings.length} total</span></div>
            <div className="bookings-table-wrapper">
              <table className="bookings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Service</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Pickup &amp; return</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className={booking.status === 'cancelled' ? 'cancelled-booking' : ''}>
                    <td>{booking.date}</td>
                    <td>{booking.time}</td>
                    <td>{booking.service}</td>
                    <td>{booking.name}</td>
                    <td>{booking.email}</td>
                    <td>{booking.transportService ? 'Yes' : 'No'}</td>
                    <td>{booking.notes || '—'}</td>
                    <td>
                      <span className={`booking-status ${booking.status}`}>{booking.status}</span>
                      {booking.cancellationReason && <small className="cancellation-reason">{booking.cancellationReason}</small>}
                    </td>
                    <td>
                      {booking.status === 'confirmed' && (cancellingId === booking.id ? (
                        <div className="cancel-booking-form">
                          <label>Reason for cancellation
                            <textarea rows={3} maxLength={500} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} autoFocus />
                          </label>
                          <div>
                            <button type="button" disabled={submittingCancellation} onClick={() => cancelBooking(booking)}>Confirm cancellation</button>
                            <button className="cancel-dismiss" type="button" disabled={submittingCancellation} onClick={() => { setCancellingId(null); setCancellationReason(''); }}>Keep booking</button>
                          </div>
                        </div>
                      ) : (
                        <button className="cancel-booking-button" type="button" onClick={() => { setCancellingId(booking.id); setCancellationReason(''); }}>Cancel booking</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              {bookings.length === 0 && <p>No bookings found.</p>}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
