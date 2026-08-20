interface HeroProps {
  onBookNow?: () => void;
}

export function Hero({ onBookNow }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="hero-kicker">Siouxland's local detailing specialists</p>
        <h1 className="hero-logo">
          <img src="/social/logo-white.png" alt="Stanbrough Sparkle" />
        </h1>
        <p className="hero-description">
          You can trust us to provide a professional and thorough detailing service for your vehicle. We offer a range of services to keep your car looking its best, from exterior washes to complete interior and exterior detailing.
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
