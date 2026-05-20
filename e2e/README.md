# End-to-End OpenTelemetry Examples

Multi-service examples demonstrating distributed tracing with **W3C trace context propagation** across the full request path — frontend → backend → "database". The point is to show what an end-to-end trace looks like in Sematext Cloud, not just a single-service span.

Each example here is intentionally minimal — one frontend, one (or more) backend services, the smallest amount of business logic needed to produce a multi-span trace tree.

## Examples

| Stack | Path |
|---|---|
| React + Express | [`react-express/`](react-express/) |

(More language combinations welcome — PRs appreciated.)

## Why these examples use the managed OTLP endpoint

The per-language single-service examples in this repo target the Sematext Agent flow — the service ships OTLP locally to a running Sematext Agent. That's the recommended path when you already run the agent for infrastructure monitoring.

The end-to-end examples use Sematext's **managed OTLP endpoint** instead, for one specific reason: browser-side OpenTelemetry. Browsers can't ship OTLP spans directly to *any* remote OTLP receiver — agent or managed — because of CORS. So the frontend ships spans to a same-origin proxy endpoint on its own backend, and the backend forwards to Sematext. The backend → Sematext leg is the simplest with the managed endpoint (one URL, one header), which is why we use it here. The same proxy pattern works if you'd rather forward through a local agent — only the upstream URL changes.

This is a design choice for the demo, not a recommendation against the agent. Both flows are first-class.

## What "end-to-end" actually means here

Each example produces a single distributed trace per user action, with a span tree like:

```
user.interaction (frontend root span)
└── HTTP <method> /api/<endpoint> (frontend auto-instrumented fetch span)
    └── <method> /api/<endpoint> (backend auto-instrumented HTTP server span)
        └── db.query <table> (backend manual span)
```

The W3C `traceparent` header is the glue — the frontend's fetch instrumentation injects it on outbound HTTP requests, and the backend's auto-instrumentation reads it and attaches its spans to the correct parent.

## CORS note

OpenTelemetry from the browser is the most common source of confusion in setups like this. Browsers can't ship OTLP spans directly to a remote OTLP receiver because of CORS. These examples handle that by having the backend act as an OTLP proxy: the frontend POSTs to a same-origin endpoint on its own backend, which forwards to Sematext with the auth header attached.

If you're considering production browser-side telemetry, this same pattern is the simplest way to make it work.
