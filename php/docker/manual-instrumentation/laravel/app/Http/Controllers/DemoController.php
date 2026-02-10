<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;

class DemoController
{
    public function health(): string
    {
        return 'healthy';
    }

    public function ready(): string
    {
        return 'ready';
    }

    public function root(): JsonResponse
    {
        $startTime = microtime(true);

        $tracer = Globals::tracerProvider()->getTracer('php-laravel-manual', '1.0.0');
        $meter = Globals::meterProvider()->getMeter('php-laravel-manual', '1.0.0');

        $requestCounter = $meter->createCounter('http.server.requests', '1', 'Total number of HTTP requests');
        $requestDuration = $meter->createHistogram('http.server.duration', 'ms', 'HTTP request duration');
        $activeRequests = $meter->createUpDownCounter('http.server.active_requests', '1', 'Number of active HTTP requests');

        $activeRequests->add(1, ['endpoint' => '/', 'method' => 'GET']);

        // Manual span creation
        $span = $tracer->spanBuilder('handle-root-request')
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->startSpan();
        $scope = $span->activate();

        try {
            $span->setAttribute('endpoint', '/');
            $span->setAttribute('method', 'GET');
            $span->setAttribute('instrumentation.type', 'manual');

            $this->emitLog('info', 'Root endpoint accessed', [
                'endpoint' => '/',
                'method' => 'GET',
            ]);

            $span->setStatus(StatusCode::STATUS_OK);

            $duration = (microtime(true) - $startTime) * 1000;
            $requestCounter->add(1, ['endpoint' => '/', 'method' => 'GET', 'status' => 200]);
            $requestDuration->record($duration, ['endpoint' => '/', 'method' => 'GET', 'status' => 200]);
            $activeRequests->add(-1, ['endpoint' => '/', 'method' => 'GET']);

            return response()->json([
                'message' => 'Hello from Sematext OpenTelemetry Example!',
                'service' => env('OTEL_SERVICE_NAME', 'php-laravel-docker-manual'),
                'instrumentation' => 'manual',
            ]);
        } finally {
            $scope->detach();
            $span->end();
        }
    }

    public function getUser(string $userId): JsonResponse
    {
        $startTime = microtime(true);

        $tracer = Globals::tracerProvider()->getTracer('php-laravel-manual', '1.0.0');
        $meter = Globals::meterProvider()->getMeter('php-laravel-manual', '1.0.0');

        $requestCounter = $meter->createCounter('http.server.requests', '1', 'Total number of HTTP requests');
        $requestDuration = $meter->createHistogram('http.server.duration', 'ms', 'HTTP request duration');
        $activeRequests = $meter->createUpDownCounter('http.server.active_requests', '1', 'Number of active HTTP requests');

        $activeRequests->add(1, ['endpoint' => '/users/<id>', 'method' => 'GET']);

        // Create parent span for the entire operation
        $parentSpan = $tracer->spanBuilder('get-user-operation')
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->startSpan();
        $parentScope = $parentSpan->activate();

        try {
            $parentSpan->setAttribute('user.id', $userId);
            $parentSpan->setAttribute('operation', 'get_user');

            $this->emitLog('info', "Fetching user with ID: {$userId}", [
                'user_id' => $userId,
                'endpoint' => '/users/<id>',
            ]);

            // Create nested span for database lookup
            $dbSpan = $tracer->spanBuilder('database.lookup')
                ->setSpanKind(SpanKind::KIND_CLIENT)
                ->startSpan();
            $dbScope = $dbSpan->activate();

            $dbSpan->setAttribute('db.system', 'postgresql');
            $dbSpan->setAttribute('db.operation', 'SELECT');
            $dbSpan->setAttribute('db.table', 'users');
            $dbSpan->setAttribute('user.id', $userId);

            // Simulate database call
            usleep(100000); // 100ms

            $this->emitLog('debug', "Database query completed for user {$userId}", [
                'user_id' => $userId,
                'db_duration_ms' => 100,
            ]);

            $dbSpan->setStatus(StatusCode::STATUS_OK);
            $dbScope->detach();
            $dbSpan->end();

            // Create nested span for business logic
            $processSpan = $tracer->spanBuilder('process.user.data')
                ->setSpanKind(SpanKind::KIND_INTERNAL)
                ->startSpan();
            $processScope = $processSpan->activate();

            $processSpan->setAttribute('operation', 'transform');
            $processSpan->setAttribute('user.id', $userId);

            // Simulate processing
            usleep(50000); // 50ms

            $this->emitLog('debug', "User data processed for {$userId}", [
                'user_id' => $userId,
                'processing_duration_ms' => 50,
            ]);

            $processSpan->setStatus(StatusCode::STATUS_OK);
            $processScope->detach();
            $processSpan->end();

            $parentSpan->setStatus(StatusCode::STATUS_OK);

            $duration = (microtime(true) - $startTime) * 1000;
            $requestCounter->add(1, ['endpoint' => '/users/<id>', 'method' => 'GET', 'status' => 200]);
            $requestDuration->record($duration, ['endpoint' => '/users/<id>', 'method' => 'GET', 'status' => 200]);
            $activeRequests->add(-1, ['endpoint' => '/users/<id>', 'method' => 'GET']);

            return response()->json([
                'id' => $userId,
                'name' => "User {$userId}",
                'email' => "user{$userId}@example.com",
            ]);
        } catch (\Throwable $e) {
            $parentSpan->recordException($e);
            $parentSpan->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());

            $this->emitLog('error', "Error fetching user: {$e->getMessage()}", [
                'user_id' => $userId,
                'error_message' => $e->getMessage(),
            ]);

            $duration = (microtime(true) - $startTime) * 1000;
            $requestCounter->add(1, ['endpoint' => '/users/<id>', 'method' => 'GET', 'status' => 500]);
            $requestDuration->record($duration, ['endpoint' => '/users/<id>', 'method' => 'GET', 'status' => 500]);
            $activeRequests->add(-1, ['endpoint' => '/users/<id>', 'method' => 'GET']);

            return response()->json(['error' => $e->getMessage()], 500);
        } finally {
            $parentScope->detach();
            $parentSpan->end();
        }
    }

    public function slow(): JsonResponse
    {
        $tracer = Globals::tracerProvider()->getTracer('php-laravel-manual', '1.0.0');

        // Manual span with nested operations
        $span = $tracer->spanBuilder('slow-operation')
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->startSpan();
        $scope = $span->activate();

        try {
            $span->setAttribute('operation.type', 'slow');
            $span->setAttribute('expected.duration', '2000ms');

            $this->emitLog('info', 'Slow endpoint called - simulating delay');

            // Create nested spans for different slow operations
            $dbSpan = $tracer->spanBuilder('slow.database.query')
                ->setSpanKind(SpanKind::KIND_CLIENT)
                ->startSpan();
            $dbScope = $dbSpan->activate();
            $dbSpan->setAttribute('db.query.duration_ms', 1000);
            sleep(1);
            $dbSpan->setStatus(StatusCode::STATUS_OK);
            $dbScope->detach();
            $dbSpan->end();

            $apiSpan = $tracer->spanBuilder('slow.external.api')
                ->setSpanKind(SpanKind::KIND_CLIENT)
                ->startSpan();
            $apiScope = $apiSpan->activate();
            $apiSpan->setAttribute('api.call.duration_ms', 1000);
            sleep(1);
            $apiSpan->setStatus(StatusCode::STATUS_OK);
            $apiScope->detach();
            $apiSpan->end();

            $this->emitLog('info', 'Slow operation completed');
            $span->setStatus(StatusCode::STATUS_OK);

            return response()->json(['message' => 'This took 2 seconds!']);
        } finally {
            $scope->detach();
            $span->end();
        }
    }

    public function error(): JsonResponse
    {
        $startTime = microtime(true);

        $tracer = Globals::tracerProvider()->getTracer('php-laravel-manual', '1.0.0');
        $meter = Globals::meterProvider()->getMeter('php-laravel-manual', '1.0.0');

        $requestCounter = $meter->createCounter('http.server.requests', '1', 'Total number of HTTP requests');
        $requestDuration = $meter->createHistogram('http.server.duration', 'ms', 'HTTP request duration');
        $activeRequests = $meter->createUpDownCounter('http.server.active_requests', '1', 'Number of active HTTP requests');

        $activeRequests->add(1, ['endpoint' => '/error', 'method' => 'GET']);

        $span = $tracer->spanBuilder('error-operation')
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->startSpan();
        $scope = $span->activate();

        try {
            $this->emitLog('warning', 'Error endpoint called - throwing intentional error', [
                'endpoint' => '/error',
                'test' => true,
            ]);

            $span->setAttribute('error.intentional', true);
            $span->setAttribute('error.type', 'TestError');

            throw new \RuntimeException('Intentional error for testing traces');
        } catch (\Throwable $e) {
            $span->recordException($e);
            $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());

            $this->emitLog('error', 'Intentional error thrown', [
                'error_message' => $e->getMessage(),
                'error_type' => 'TestError',
                'endpoint' => '/error',
            ]);

            $duration = (microtime(true) - $startTime) * 1000;
            $requestCounter->add(1, ['endpoint' => '/error', 'method' => 'GET', 'status' => 500]);
            $requestDuration->record($duration, ['endpoint' => '/error', 'method' => 'GET', 'status' => 500]);
            $activeRequests->add(-1, ['endpoint' => '/error', 'method' => 'GET']);

            return response()->json(['error' => $e->getMessage()], 500);
        } finally {
            $scope->detach();
            $span->end();
        }
    }

    private function emitLog(string $level, string $message, array $context = []): void
    {
        $span = \OpenTelemetry\API\Trace\Span::getCurrent();
        if ($span->getContext()->isValid()) {
            $spanContext = $span->getContext();
            $context['trace_id'] = $spanContext->getTraceId();
            $context['span_id'] = $spanContext->getSpanId();
        }

        $logMessage = $message . ' ' . json_encode($context);
        match ($level) {
            'error' => error_log("[ERROR] {$logMessage}"),
            'warning' => error_log("[WARNING] {$logMessage}"),
            'debug' => error_log("[DEBUG] {$logMessage}"),
            default => error_log("[INFO] {$logMessage}"),
        };
    }
}
