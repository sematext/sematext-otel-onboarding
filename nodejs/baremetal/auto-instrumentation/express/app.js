// Configure OpenTelemetry before any other imports
const { configureOpenTelemetry } = require('./otel-config');
configureOpenTelemetry();

const express = require('express');
const { trace } = require('@opentelemetry/api');

const app = express();
const port = process.env.PORT || 8080;

// Health check endpoints
app.get('/health', (req, res) => {
    res.send('healthy');
});

app.get('/ready', (req, res) => {
    res.send('ready');
});

// Root endpoint
app.get('/', (req, res) => {
    console.log('Root endpoint accessed');
    res.json({
        message: 'Hello from Sematext OpenTelemetry Example!',
        service: process.env.OTEL_SERVICE_NAME || 'nodejs-express-auto',
        instrumentation: 'auto'
    });
});

// Users endpoint with custom span attributes
app.get('/users/:id', async (req, res) => {
    const userId = req.params.id;
    console.log(`Fetching user with ID: ${userId}`);

    // Get current span (created automatically by auto-instrumentation)
    const span = trace.getActiveSpan();
    if (span) {
        span.setAttributes({
            'user.id': userId,
            'operation': 'get_user'
        });
    }

    // Simulate database call
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`Successfully retrieved user ${userId}`);

    res.json({
        id: userId,
        name: `User ${userId}`,
        email: `user${userId}@example.com`
    });
});

// Slow endpoint
app.get('/slow', async (req, res) => {
    console.log('Slow endpoint called - simulating delay');

    const span = trace.getActiveSpan();
    if (span) {
        span.setAttribute('operation.type', 'slow');
    }

    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Slow operation completed');
    res.json({ message: 'This took 2 seconds!' });
});

// Error endpoint
app.get('/error', (req, res) => {
    console.error('Error endpoint called - throwing intentional error');

    const span = trace.getActiveSpan();
    if (span) {
        span.setAttribute('error.intentional', true);
    }

    throw new Error('Intentional error for testing traces');
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error occurred:', err.message);

    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(err);
        span.setStatus({ code: 2, message: err.message });
    }

    res.status(500).json({ error: err.message });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log('==============================================');
    console.log(`Server started on port ${port}`);
    console.log(`Try these endpoints:`);
    console.log(`  http://localhost:${port}/`);
    console.log(`  http://localhost:${port}/users/123`);
    console.log(`  http://localhost:${port}/slow`);
    console.log(`  http://localhost:${port}/error`);
    console.log('==============================================');
});
