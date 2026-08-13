import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { BookingPage } from './pages/BookingPage';
import { AdminPanel } from './components/AdminPanel';
import { Booking } from './components/RequestForm';
import { Footer } from './components/Footer';

function App() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || 'home');

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="app-shell">
      {route === 'admin' ? (
        <AdminPanel onLogout={() => (window.location.hash = '#home')} />
      ) : route === 'book' ? (
        <BookingPage onBookingComplete={setBooking} />
      ) : (
        <HomePage onBookNow={() => (window.location.hash = '#book')} />
      )}
      {booking && route === 'book' && (
        <section className="confirmation-card booking-confirmation">
          <h2>Booking confirmed!</h2>
          <p>
            {booking.name}, your {booking.service} is scheduled for {booking.date} at {booking.time}.
          </p>
          <div className="calendar-links">
            <a className="button" href={booking.googleCalendarUrl} target="_blank" rel="noreferrer">
              Add to Google Calendar
            </a>
            <a className="button" href={booking.icsUrl} download="max-autodetail-booking.ics">
              Download Apple Calendar Event
            </a>
          </div>
        </section>
      )}
      {route !== 'admin' && <Footer />}
    </div>
  );
}

export default App;
