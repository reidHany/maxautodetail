interface HeroProps {
  onBookNow?: () => void;
}

export function Hero({ onBookNow }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p>Your Local Siouxland Automotive Detailing Service</p>
        <h1 className="eyebrow">Stanbrough Sparkle</h1>
        <p>
          Your can trust us to provide a professional and thorough detailing service for your vehicle. We offer a range of services to keep your car looking its best, from exterior washes to complete interior and exterior detailing.
        </p>
        {onBookNow && (
          <button className="hero-button" type="button" onClick={onBookNow}>
            Book a Detailing
          </button>
        )}
      </div>
    </section>
  );
}
