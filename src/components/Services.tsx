const services = [
  { title: 'Exterior Detail', description: 'Wash, clay bar, polish, and sealant for a showroom finish.' },
  { title: 'Interior Detail', description: 'Deep-clean carpets, leather, trim, and vents.' },
  { title: 'Ceramic Coating', description: 'Long-lasting paint protection with water beading.' },
];

export function Services() {
  return (
    <section className="services-section" id="services">
      <h2>Our Services</h2>
      <div className="service-grid">
        {services.map((service) => (
          <article key={service.title} className="service-card">
            <h3>{service.title}</h3>
            <p>{service.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
