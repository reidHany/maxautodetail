import { useState } from 'react';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { RequestForm } from './components/RequestForm';

function App() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="app-shell">
      <Hero />
      <main>
        <Services />
        <RequestForm onSubmit={() => setSubmitted(true)} />
        {submitted && (
          <section className="confirmation-card">
            <h2>Request submitted!</h2>
            <p>We will contact you soon to schedule your auto detailing service.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
