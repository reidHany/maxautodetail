export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="footer-main">
        <div className="footer-brand">
          <a className="footer-logo" href="#home" aria-label="Stanbrough Sparkle home">
            <span className="footer-mark">SS</span>
            <span>
              <strong>Stanbrough Sparkle</strong>
              <small>Automotive detailing</small>
            </span>
          </a>
          <p>Your local Northwest Iowa automotive detailing service.</p>
          <a className="footer-cta" href="#book">Book your detail <span aria-hidden="true">→</span></a>
        </div>

        <nav className="footer-column" aria-label="Footer navigation">
          <p className="footer-heading">Explore</p>
          <a href="#home">Home</a>
          <a href="#services">Services</a>
          <a href="#transformations">Transformations</a>
          <a href="#book">Book now</a>
        </nav>

        <div className="footer-column">
          <p className="footer-heading">Follow Us!</p>
          <a href="https://www.facebook.com/share/1EwPhCTJ2U/?mibextid=wwXlfr" target="_blank" rel="noreferrer">Facebook <span aria-hidden="true">↗</span></a>
          <a href="https://www.instagram.com/stanbroughsparkle/" target="_blank" rel="noreferrer">Instagram <span aria-hidden="true">↗</span></a>
          <a href="https://www.tiktok.com/@stanbrough.sparkle/" target="_blank" rel="noreferrer">TikTok <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Stanbrough Sparkle</span>
        <span>Website by Hany Web Developers</span>
      </div>
    </footer>
  );
}
