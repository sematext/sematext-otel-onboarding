import { useState } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('e2e-frontend.app');

type Row = { id: number; title: string; tier: string };

export function App() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    // Start a root span for the user interaction. The fetch instrumentation
    // will pick this up as the active parent context and create a child
    // span for the HTTP call, with the W3C traceparent header propagated
    // to the backend.
    await tracer.startActiveSpan('user.fetch-data', async (span) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.rows);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      } finally {
        setLoading(false);
        span.end();
      }
    });
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Sematext OTel End-to-End Demo</h1>
      <p>
        Click the button to call the backend. The trace should appear in your Sematext Tracing App within 60 seconds,
        spanning the browser interaction, the HTTP call, the Express handler, and the (fake) database query.
      </p>
      <button onClick={handleClick} disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        {loading ? 'Loading…' : 'Fetch data'}
      </button>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {rows && (
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{r.title}</strong> — tier: {r.tier}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
