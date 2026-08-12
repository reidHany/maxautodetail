import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  notes?: string;
}

interface AdminPanelProps {
  onLogout: () => void;
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('adminToken'));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch('/api/admin/bookings', {
      headers: { Authorization: `Bearer ${token}` },
    })
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
  }, [token]);

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
    setToken(data.token);
    localStorage.setItem('adminToken', data.token);
    setPassword('');
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    onLogout();
  };

  return (
    <section className="request-section">
      <h2>Admin Dashboard</h2>
      {!token ? (
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
          <button className="button" type="button" onClick={handleLogout}>
            Logout
          </button>
          <div className="bookings-table-wrapper">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Service</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.date}</td>
                    <td>{booking.time}</td>
                    <td>{booking.service}</td>
                    <td>{booking.name}</td>
                    <td>{booking.email}</td>
                    <td>{booking.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && <p>No bookings found.</p>}
          </div>
        </>
      )}
    </section>
  );
}
