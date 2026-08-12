import { Booking, RequestForm } from '../components/RequestForm';

interface BookingPageProps {
  onBookingComplete: (booking: Booking) => void;
}

export function BookingPage({ onBookingComplete }: BookingPageProps) {
  return (
    <section className="booking-page">
      <div className="booking-hero">
        <div>
          <p className="eyebrow">Book Your Detail</p>
          <h1>Choose your date and time for premium auto detailing.</h1>
          <p>Our team delivers showroom finish detail services with a luxury experience.</p>
        </div>
      </div>
      <div className="booking-content">
        <div className="booking-info-panel">
          <div className="panel-card">
            <h2>How it works</h2>
            <ul>
              <li>Pick a service</li>
              <li>Choose an available date and time</li>
              <li>Confirm your booking and add to calendar</li>
            </ul>
          </div>
          <div className="panel-card">
            <h2>Why choose us</h2>
            <p>Precision detail, premium customer care, and flawless finish for every vehicle.</p>
          </div>
        </div>
        <RequestForm onSubmit={onBookingComplete} />
      </div>
    </section>
  );
}
