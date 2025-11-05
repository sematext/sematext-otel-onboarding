// Configure OpenTelemetry before any other imports
const { configureOpenTelemetry } = require('./otel-config');
configureOpenTelemetry();

const express = require('express');
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');
const { metrics } = require('@opentelemetry/api');
const { logs } = require('@opentelemetry/api-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');

const app = express();
const port = process.env.PORT || 8080;

// Get tracer for manual span creation
const tracer = trace.getTracer('nodejs-express-manual', '1.0.0');

// Get meter for manual metrics creation
const meter = metrics.getMeter('nodejs-express-manual', '1.0.0');

// Get logger for manual logs creation
const logger = logs.getLogger('nodejs-express-manual', '1.0.0');

// Create custom metrics
const requestCounter = meter.createCounter('http.server.requests', {
    description: 'Total number of HTTP requests',
    unit: '1'
});

const requestDuration = meter.createHistogram('http.server.duration', {
    description: 'HTTP request duration',
    unit: 'ms'
});

const activeRequests = meter.createUpDownCounter('http.server.active_requests', {
    description: 'Number of active HTTP requests',
    unit: '1'
});

// Helper function to emit structured logs with trace correlation
function emitLog(severityText, body, attributes = {}) {
    const activeSpan = trace.getActiveSpan();
    const logAttributes = { ...attributes };

    // Add trace correlation
    if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        logAttributes['trace_id'] = spanContext.traceId;
        logAttributes['span_id'] = spanContext.spanId;
        logAttributes['trace_flags'] = spanContext.traceFlags;
    }

    logger.emit({
        severityNumber: getSeverityNumber(severityText),
        severityText: severityText.toUpperCase(),
        body: body,
        attributes: logAttributes,
        timestamp: Date.now()
    });

    // Also console.log for visibility
    console.log(`[${severityText.toUpperCase()}] ${body}`);
}

function getSeverityNumber(severityText) {
    const map = {
        'trace': SeverityNumber.TRACE,
        'debug': SeverityNumber.DEBUG,
        'info': SeverityNumber.INFO,
        'warn': SeverityNumber.WARN,
        'error': SeverityNumber.ERROR,
        'fatal': SeverityNumber.FATAL
    };
    return map[severityText.toLowerCase()] || SeverityNumber.INFO;
}

// Health check endpoints
app.get('/health', (req, res) => {
    res.send('healthy');
});

app.get('/ready', (req, res) => {
    res.send('ready');
});

// Root endpoint
app.get('/', (req, res) => {
    const startTime = Date.now();

    // Increment active requests metric
    activeRequests.add(1, { endpoint: '/', method: 'GET' });

    // Manual span creation
    const span = tracer.startSpan('handle-root-request');
    span.setAttributes({
        'endpoint': '/',
        'method': 'GET',
        'instrumentation.type': 'manual'
    });

    // Emit custom log
    emitLog('info', 'Root endpoint accessed', {
        endpoint: '/',
        method: 'GET',
        user_agent: req.get('user-agent')
    });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Record metrics
    const duration = Date.now() - startTime;
    requestCounter.add(1, { endpoint: '/', method: 'GET', status: 200 });
    requestDuration.record(duration, { endpoint: '/', method: 'GET', status: 200 });
    activeRequests.add(-1, { endpoint: '/', method: 'GET' });

    res.json({
        message: 'Hello from Sematext OpenTelemetry Example!',
        service: process.env.OTEL_SERVICE_NAME || 'nodejs-express-manual',
        instrumentation: 'manual'
    });
});

// Users endpoint with nested manual spans
app.get('/users/:id', async (req, res) => {
    const startTime = Date.now();
    const userId = req.params.id;

    activeRequests.add(1, { endpoint: '/users/:id', method: 'GET' });

    // Create parent span for the entire operation
    return tracer.startActiveSpan('get-user-operation', async (parentSpan) => {
        parentSpan.setAttributes({
            'user.id': userId,
            'operation': 'get_user'
        });

        try {
            emitLog('info', `Fetching user with ID: ${userId}`, {
                user_id: userId,
                endpoint: '/users/:id'
            });

            // Create nested span for database lookup
            await tracer.startActiveSpan('database.lookup', async (dbSpan) => {
                dbSpan.setAttributes({
                    'db.system': 'postgresql',
                    'db.operation': 'SELECT',
                    'db.table': 'users',
                    'user.id': userId
                });

                // Simulate database call
                await new Promise(resolve => setTimeout(resolve, 100));

                emitLog('debug', `Database query completed for user ${userId}`, {
                    user_id: userId,
                    db_duration_ms: 100
                });

                dbSpan.setStatus({ code: SpanStatusCode.OK });
                dbSpan.end();
            });

            // Create nested span for business logic
            await tracer.startActiveSpan('process.user.data', async (processSpan) => {
                processSpan.setAttributes({
                    'operation': 'transform',
                    'user.id': userId
                });

                // Simulate processing
                await new Promise(resolve => setTimeout(resolve, 50));

                emitLog('debug', `User data processed for ${userId}`, {
                    user_id: userId,
                    processing_duration_ms: 50
                });

                processSpan.setStatus({ code: SpanStatusCode.OK });
                processSpan.end();
            });

            parentSpan.setStatus({ code: SpanStatusCode.OK });
            parentSpan.end();

            // Record metrics
            const duration = Date.now() - startTime;
            requestCounter.add(1, { endpoint: '/users/:id', method: 'GET', status: 200 });
            requestDuration.record(duration, { endpoint: '/users/:id', method: 'GET', status: 200 });
            activeRequests.add(-1, { endpoint: '/users/:id', method: 'GET' });

            res.json({
                id: userId,
                name: `User ${userId}`,
                email: `user${userId}@example.com`
            });
        } catch (error) {
            parentSpan.recordException(error);
            parentSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message
            });
            parentSpan.end();

            emitLog('error', `Error fetching user: ${error.message}`, {
                user_id: userId,
                error_message: error.message,
                error_stack: error.stack
            });

            const duration = Date.now() - startTime;
            requestCounter.add(1, { endpoint: '/users/:id', method: 'GET', status: 500 });
            requestDuration.record(duration, { endpoint: '/users/:id', method: 'GET', status: 500 });
            activeRequests.add(-1, { endpoint: '/users/:id', method: 'GET' });

            res.status(500).json({ error: error.message });
        }
    });
});

// Slow endpoint with manual span
app.get('/slow', async (req, res) => {
    return tracer.startActiveSpan('slow-operation', async (span) => {
        span.setAttributes({
            'operation.type': 'slow',
            'expected.duration': '2000ms'
        });

        console.log('Slow endpoint called - simulating delay');

        // Create nested spans for different slow operations
        await tracer.startActiveSpan('slow.database.query', async (dbSpan) => {
            dbSpan.setAttribute('db.query.duration_ms', 1000);
            await new Promise(resolve => setTimeout(resolve, 1000));
            dbSpan.setStatus({ code: SpanStatusCode.OK });
            dbSpan.end();
        });

        await tracer.startActiveSpan('slow.external.api', async (apiSpan) => {
            apiSpan.setAttribute('api.call.duration_ms', 1000);
            await new Promise(resolve => setTimeout(resolve, 1000));
            apiSpan.setStatus({ code: SpanStatusCode.OK });
            apiSpan.end();
        });

        console.log('Slow operation completed');

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        res.json({ message: 'This took 2 seconds!' });
    });
});

// Error endpoint with manual error tracking
app.get('/error', (req, res) => {
    const startTime = Date.now();
    activeRequests.add(1, { endpoint: '/error', method: 'GET' });

    const span = tracer.startSpan('error-operation');

    try {
        emitLog('warn', 'Error endpoint called - throwing intentional error', {
            endpoint: '/error',
            test: true
        });

        span.setAttributes({
            'error.intentional': true,
            'error.type': 'TestError'
        });

        throw new Error('Intentional error for testing traces');
    } catch (error) {
        // Manually record exception
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
        });

        span.end();

        emitLog('error', 'Intentional error thrown', {
            error_message: error.message,
            error_type: 'TestError',
            endpoint: '/error'
        });

        const duration = Date.now() - startTime;
        requestCounter.add(1, { endpoint: '/error', method: 'GET', status: 500 });
        requestDuration.record(duration, { endpoint: '/error', method: 'GET', status: 500 });
        activeRequests.add(-1, { endpoint: '/error', method: 'GET' });

        res.status(500).json({ error: error.message });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error occurred:', err.message);

    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(err);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message
        });
    }

    res.status(500).json({ error: err.message });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log('==============================================');
    console.log(`Server started on port ${port}`);
    console.log(`Manual Instrumentation Mode`);
    console.log(`Try these endpoints:`);
    console.log(`  http://localhost:${port}/`);
    console.log(`  http://localhost:${port}/users/123`);
    console.log(`  http://localhost:${port}/slow`);
    console.log(`  http://localhost:${port}/error`);
    console.log('==============================================');
});
