import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { BookingPage } from './pages/BookingPage';
import { AdminPanel } from './components/AdminPanel';
import { Booking } from './components/RequestForm';
import { Footer } from './components/Footer';
import { BookingSuccess } from './components/BookingSuccess';

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
        booking ? (
          <BookingSuccess booking={booking} onBackHome={() => {
            setBooking(null);
            window.location.hash = '#home';
          }} />
        ) : (
          <BookingPage onBookingComplete={setBooking} />
        )
      ) : (
        <HomePage onBookNow={() => {
          setBooking(null);
          window.location.hash = '#book';
        }} />
      )}
      {route !== 'admin' && <Footer />}
    </div>
  );
}

export default App;
