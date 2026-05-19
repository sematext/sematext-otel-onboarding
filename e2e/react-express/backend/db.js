/*
 * Fake in-memory "database" with a manually-instrumented query span.
 *
 * The point of this file is to demonstrate manual instrumentation
 * alongside the auto-instrumentation that wraps Express. The resulting
 * trace tree shows the manual db.query span as a child of the
 * auto-created GET /api/data span.
 */

const { trace, SpanStatusCode } = require('@opentelemetry/api');

const tracer = trace.getTracer('e2e-backend.db');

const records = [
  { id: 1, title: 'Hello from the fake DB', tier: 'free' },
  { id: 2, title: 'Another row', tier: 'pro' },
  { id: 3, title: 'And one more', tier: 'enterprise' },
];

async function query(tableName) {
  return tracer.startActiveSpan(`db.query ${tableName}`, async (span) => {
    span.setAttribute('db.system', 'memory');
    span.setAttribute('db.statement', `SELECT * FROM ${tableName}`);
    span.setAttribute('db.operation', 'SELECT');

    try {
      // Simulate the latency of a real database call so the span has visible width.
      await new Promise((resolve) => setTimeout(resolve, 50));
      span.setStatus({ code: SpanStatusCode.OK });
      return records;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { query };
