/*
 * Express backend for the Sematext OTel end-to-end demo.
 *
 * Two endpoints:
 *   GET  /api/data                — returns records from the fake DB.
 *                                   Auto-instrumented Express span +
 *                                   manual db.query span underneath.
 *
 *   POST /api/otel-proxy/v1/traces — receives OTLP/HTTP protobuf payloads
 *                                    from the browser frontend (same-origin,
 *                                    so no CORS issue) and forwards them to
 *                                    Sematext's managed OTLP endpoint with
 *                                    the X-API-TOKEN header attached.
 */

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Disable ETag generation so every Fetch data click in the demo returns
// a fresh 200 with a body. Otherwise Express's default conditional-GET
// handling turns repeat clicks into 304 Not Modified, which is correct
// HTTP behavior but noisy in the trace explorer for a learning demo.
app.disable('etag');

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  || 'https://otlp-receiver.eu.sematext.com';
const token = process.env.SEMATEXT_TRACING_TOKEN;

// CORS is only needed if the frontend runs on a different origin from this
// server. With the Vite dev proxy this isn't needed in development, but it
// makes the demo robust if a reader runs the frontend standalone.
app.use(cors());

app.get('/api/data', async (req, res) => {
  const rows = await db.query('records');
  res.json({ rows });
});

// Proxy OTLP/HTTP from the browser to Sematext.
// Accepts any payload format the browser ships (the OTel HTTP exporter
// defaults to JSON in browsers, protobuf in Node — be agnostic) and
// forwards the body untouched with the Content-Type and Content-Encoding
// preserved and the Sematext-specific X-API-TOKEN header attached.
app.post(
  '/api/otel-proxy/v1/traces',
  express.raw({ type: '*/*', limit: '10mb' }),
  async (req, res) => {
    try {
      const contentType = req.headers['content-type'] || 'application/json';
      const headers = {
        'Content-Type': contentType,
        'X-API-TOKEN': token || '',
      };
      const contentEncoding = req.headers['content-encoding'];
      if (contentEncoding) headers['Content-Encoding'] = contentEncoding;

      const upstream = await fetch(`${otlpEndpoint}/v1/traces`, {
        method: 'POST',
        headers,
        body: req.body,
      });

      if (upstream.status >= 400) {
        const errText = await upstream.text().catch(() => '');
        console.error(
          `[otel-proxy] upstream ${upstream.status} (content-type=${contentType}, body bytes=${req.body?.length || 0}): ${errText.slice(0, 500)}`
        );
      }
      res.status(upstream.status).end();
    } catch (err) {
      console.error('[otel-proxy] forward failed:', err.message);
      res.status(502).end();
    }
  }
);

app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
  console.log(`[backend] OTLP proxy forwards to ${otlpEndpoint}/v1/traces`);
});
