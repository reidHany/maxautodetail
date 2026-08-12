interface HeroProps {
  onBookNow?: () => void;
}

export function Hero({ onBookNow }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">StanBrough Sparkle</p>
        <h1>Elevated automotive detailing with a red-carpet finish.</h1>
        <p>
          Precision detailing, premium service, and showroom results delivered with a modern luxury experience.
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
