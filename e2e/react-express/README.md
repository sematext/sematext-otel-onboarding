# React + Express — End-to-End OpenTelemetry Tracing

A minimal full-stack demo that produces a single end-to-end trace in your Sematext Tracing App per user interaction. Three "real" hops plus the browser interaction itself:

```
user.fetch-data                          (frontend, manual root span)
└── HTTP GET /api/data                   (frontend, auto-instrumented fetch)
    └── GET /api/data                    (backend, auto-instrumented express)
        └── db.query records             (backend, manual span)
```

W3C trace context propagation is wired through automatically — the browser's fetch instrumentation adds the `traceparent` header on outbound calls; the backend's auto-instrumentation reads it and continues the trace.

## What you'll need

- Node.js 20+
- A **Sematext Tracing App** token (Sematext Cloud → Tracing Apps → your App → Integrations)
- Your Sematext region (US or EU)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set SEMATEXT_TRACING_TOKEN. Change OTEL_EXPORTER_OTLP_ENDPOINT
# to https://otlp-receiver.sematext.com if you are in the US region.
npm install
npm start
```

You should see:

```
[otel] backend tracing initialized — service=e2e-backend endpoint=https://otlp-receiver.eu.sematext.com
[backend] listening on http://localhost:3000
```

### 2. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

You should see Vite serving on `http://localhost:5173`.

### 3. Generate a trace

Open `http://localhost:5173` in your browser. Click **Fetch data**. Within ~60 seconds, head to your Sematext Tracing App and look for a service called `e2e-frontend`.

You should find a single trace with the four-span tree shown above.

## How it works

### Trace context propagation

The frontend creates a manual root span when the button is clicked. The fetch instrumentation picks up that span as the active parent and creates a child span for the HTTP call, injecting a W3C `traceparent` header into the request. The backend's HTTP auto-instrumentation extracts that header and continues the trace. Same trace ID end to end; correct parent-child relationships in the Sematext UI.

### Browser → Sematext via the backend proxy

Browsers can't POST OTLP directly to `otlp-receiver.eu.sematext.com` — CORS will block it. So the frontend's OTel exporter ships to `/api/otel-proxy/v1/traces` instead, a same-origin endpoint on its own backend. The backend forwards the payload to Sematext with the Sematext-specific `X-API-TOKEN` header attached. No browser-side credential exposure.

In development this routing is set up via the Vite dev server's proxy (`vite.config.ts` → `server.proxy`).

### Auto vs manual instrumentation

- **Backend**: started with `node --require ./otel.js server.js` so the OTel Node SDK and `@opentelemetry/auto-instrumentations-node` patch `http` and `express` *before* application code loads. The `db.query` span is added manually using `tracer.startActiveSpan` — this is the canonical pattern for adding spans around code OTel can't auto-instrument (custom data sources, business operations).
- **Frontend**: `@opentelemetry/instrumentation-fetch` is registered explicitly. The root `user.fetch-data` span is manual — auto-instrumentation in the browser is less complete than in Node and you typically have to start root spans yourself for user interactions.

## Files

```
react-express/
├── backend/
│   ├── package.json
│   ├── otel.js          # SDK init (loaded via --require before server.js)
│   ├── server.js        # /api/data endpoint + /api/otel-proxy
│   ├── db.js            # fake in-memory DB with manual span
│   └── .env.example
└── frontend/
    ├── package.json
    ├── vite.config.ts   # dev proxy /api/* → backend:3000
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── otel.ts      # browser SDK init (imported first in main.tsx)
        ├── main.tsx
        └── App.tsx      # "Fetch data" button + manual root span
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend log shows `SEMATEXT_TRACING_TOKEN is not set` | Forgot to copy `.env.example` to `.env` or didn't set the token |
| Backend starts but trace never lands in Sematext | Wrong region — token belongs to the other region (US vs EU). Edit `OTEL_EXPORTER_OTLP_ENDPOINT`. |
| Frontend console shows CORS errors for `/api/otel-proxy/v1/traces` | Backend isn't running, or Vite dev proxy isn't pointed at the right backend port |
| Trace appears but backend spans are not children of frontend span | `propagateTraceHeaderCorsUrls` in `frontend/src/otel.ts` doesn't match the fetch URL pattern. Default is `/.*/` which matches everything. |
| `Error: zone is not defined` in browser console | `zone.js` import missing or out of order — must be imported before `ZoneContextManager` |

## See also

- The [`sematext-otel` skill](../../skills/sematext-otel.md) — Claude Code Agent Skill that walks you through this kind of setup conversationally.
- Per-language single-service examples in this repo: [Node.js](../../nodejs/), [Java](../../java/), [Python](../../python/), [.NET](../../dotnet/), [PHP](../../php/).
- [Sematext OpenTelemetry documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
