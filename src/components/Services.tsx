const services = [
  { title: '$50 - Exterior Refresh', description: 'Wash and dry your vehicle\'s exterior including the tires and windows' },
  { title: '$75 - Interior Refresh', description: 'Comprehensive Vacuuming & Cleaning and Stain Treatment' },
  { title: '$120 - Complete Refresh', description: 'All of our services combined for the ultimate detailing experience' },
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
