import { FormEvent, useState } from 'react';

interface RequestFormProps {
  onSubmit: () => void;
}

export function RequestForm({ onSubmit }: RequestFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('Exterior Detail');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, service, notes }),
    });

    setName('');
    setEmail('');
    setService('Exterior Detail');
    setNotes('');
    onSubmit();
  };

  return (
    <section className="request-section">
      <h2>Schedule a Service</h2>
      <form onSubmit={handleSubmit} className="request-form">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Service
          <select value={service} onChange={(event) => setService(event.target.value)}>
            <option>Exterior Detail</option>
            <option>Interior Detail</option>
            <option>Ceramic Coating</option>
          </select>
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </label>
        <button type="submit">Request Service</button>
      </form>
    </section>
  );
}
