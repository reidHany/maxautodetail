export function SocialLinks() {
  return (
    <section className="social-links-section">
      <div className="social-links-copy">
        <p className="eyebrow">Connect with us</p>
        <h2>Follow Stanbrough Sparkle on social media</h2>
        <p>Stay updated on our latest transformations, special offers, and detailing tips.</p>
      </div>
      <div className="social-links-grid">
        <a className="social-link facebook" href="https://www.facebook.com/share/1EwPhCTJ2U/?mibextid=wwXlfr" target="_blank" rel="noreferrer" aria-label="Facebook">
          <span className="social-icon" aria-hidden="true">
            <img
              className="social-image"
              src="/social/facebook.png"
              alt="Facebook logo"
            />
          </span>
          <span>Facebook</span>
        </a>
        <a className="social-link instagram" href="https://www.instagram.com/stanbroughsparkle/" target="_blank" rel="noreferrer" aria-label="Instagram">
          <span className="social-icon" aria-hidden="true">
            <img
              className="social-image"
              src="/social/instagram.png"
              alt="Instagram logo"
            />
          </span>
          <span>Instagram</span>
        </a>
        <a className="social-link tiktok" href="https://www.tiktok.com/@stanbrough.sparkle/" target="_blank" rel="noreferrer" aria-label="TikTok">
          <span className="social-icon" aria-hidden="true">
            <img
              className="social-image"
              src="/social/tiktok.png"
              alt="TikTok logo"
            />
          </span>
          <span>TikTok</span>
        </a>
      </div>
    </section>
  );
}
