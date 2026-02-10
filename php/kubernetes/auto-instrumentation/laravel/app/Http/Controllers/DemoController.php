<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use OpenTelemetry\API\Trace\Span;
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
        // Get current span (created automatically by auto-instrumentation)
        $span = Span::getCurrent();
        $span->setAttribute('custom.attribute', 'root-endpoint');

        return response()->json([
            'message' => 'Hello from Sematext OpenTelemetry Example!',
            'service' => env('OTEL_SERVICE_NAME', 'php-laravel-k8s-auto'),
            'instrumentation' => 'auto',
        ]);
    }

    public function getUser(string $userId): JsonResponse
    {
        // Get current span and add custom attributes
        $span = Span::getCurrent();
        $span->setAttribute('user.id', $userId);
        $span->setAttribute('operation', 'get_user');

        // Simulate database call
        usleep(100000); // 100ms

        return response()->json([
            'id' => $userId,
            'name' => "User {$userId}",
            'email' => "user{$userId}@example.com",
        ]);
    }

    public function slow(): JsonResponse
    {
        $span = Span::getCurrent();
        $span->setAttribute('operation.type', 'slow');

        // Simulate slow operation
        sleep(2);

        return response()->json(['message' => 'This took 2 seconds!']);
    }

    public function error(): JsonResponse
    {
        $span = Span::getCurrent();
        $span->setAttribute('error.intentional', true);

        try {
            throw new \RuntimeException('Intentional error for testing traces');
        } catch (\Throwable $e) {
            $span->recordException($e);
            $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());

            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
