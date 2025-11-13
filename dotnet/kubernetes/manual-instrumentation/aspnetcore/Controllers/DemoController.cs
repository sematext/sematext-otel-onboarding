using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace DotnetApp.Controllers;

[ApiController]
[Route("/")]
public class DemoController : ControllerBase
{
    private readonly ILogger<DemoController> _logger;
    private readonly ActivitySource _activitySource;
    private readonly Counter<long> _requestCounter;
    private readonly Histogram<double> _requestDuration;

    public DemoController(ILogger<DemoController> logger)
    {
        _logger = logger;
        _activitySource = new ActivitySource("DotnetApp.Manual");

        // Create custom metrics
        var meter = new Meter("DotnetApp.Manual", "1.0.0");
        _requestCounter = meter.CreateCounter<long>(
            "http.server.requests",
            unit: "1",
            description: "Total number of HTTP requests");
        _requestDuration = meter.CreateHistogram<double>(
            "http.server.duration",
            unit: "ms",
            description: "HTTP request duration");
    }

    [HttpGet]
    public IActionResult GetRoot()
    {
        var startTime = Stopwatch.GetTimestamp();

        // Create manual span
        using var activity = _activitySource.StartActivity("handle-root-request", ActivityKind.Server);
        activity?.SetTag("endpoint", "/");
        activity?.SetTag("method", "GET");
        activity?.SetTag("instrumentation.type", "manual");

        // Emit custom log with trace correlation
        _logger.LogInformation("Root endpoint accessed from {UserAgent}",
            Request.Headers.UserAgent.ToString());

        activity?.SetStatus(ActivityStatusCode.Ok);

        // Record metrics
        var duration = Stopwatch.GetElapsedTime(startTime).TotalMilliseconds;
        _requestCounter.Add(1,
            new KeyValuePair<string, object?>("endpoint", "/"),
            new KeyValuePair<string, object?>("method", "GET"),
            new KeyValuePair<string, object?>("status", 200));
        _requestDuration.Record(duration,
            new KeyValuePair<string, object?>("endpoint", "/"),
            new KeyValuePair<string, object?>("method", "GET"),
            new KeyValuePair<string, object?>("status", 200));

        return Ok(new
        {
            message = "Hello from Sematext OpenTelemetry Example!",
            service = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "dotnet-aspnetcore-k8s-manual",
            instrumentation = "manual"
        });
    }

    [HttpGet("api/users/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        var startTime = Stopwatch.GetTimestamp();

        // Create parent span for the entire operation
        using var parentActivity = _activitySource.StartActivity("get-user-operation", ActivityKind.Server);
        parentActivity?.SetTag("user.id", id);
        parentActivity?.SetTag("operation", "get_user");

        try
        {
            _logger.LogInformation("Fetching user with ID: {UserId}", id);

            // Create nested span for database lookup
            using (var dbActivity = _activitySource.StartActivity("database.lookup", ActivityKind.Client))
            {
                dbActivity?.SetTag("db.system", "postgresql");
                dbActivity?.SetTag("db.operation", "SELECT");
                dbActivity?.SetTag("db.table", "users");
                dbActivity?.SetTag("user.id", id);

                // Simulate database call
                await Task.Delay(100);

                _logger.LogDebug("Database query completed for user {UserId}", id);
                dbActivity?.SetStatus(ActivityStatusCode.Ok);
            }

            // Create nested span for business logic
            using (var processActivity = _activitySource.StartActivity("process.user.data", ActivityKind.Internal))
            {
                processActivity?.SetTag("operation", "transform");
                processActivity?.SetTag("user.id", id);

                // Simulate processing
                await Task.Delay(50);

                _logger.LogDebug("User data processed for {UserId}", id);
                processActivity?.SetStatus(ActivityStatusCode.Ok);
            }

            parentActivity?.SetStatus(ActivityStatusCode.Ok);

            // Record metrics
            var duration = Stopwatch.GetElapsedTime(startTime).TotalMilliseconds;
            _requestCounter.Add(1,
                new KeyValuePair<string, object?>("endpoint", "/api/users/{id}"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 200));
            _requestDuration.Record(duration,
                new KeyValuePair<string, object?>("endpoint", "/api/users/{id}"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 200));

            return Ok(new
            {
                id = id,
                name = $"User {id}",
                email = $"user{id}@example.com"
            });
        }
        catch (Exception ex)
        {
            // Record exception in span
            parentActivity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            parentActivity?.RecordException(ex);

            _logger.LogError(ex, "Error fetching user: {ErrorMessage}", ex.Message);

            var duration = Stopwatch.GetElapsedTime(startTime).TotalMilliseconds;
            _requestCounter.Add(1,
                new KeyValuePair<string, object?>("endpoint", "/api/users/{id}"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 500));
            _requestDuration.Record(duration,
                new KeyValuePair<string, object?>("endpoint", "/api/users/{id}"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 500));

            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("api/slow")]
    public async Task<IActionResult> GetSlow()
    {
        // Manual span with nested operations
        using var activity = _activitySource.StartActivity("slow-operation", ActivityKind.Server);
        activity?.SetTag("operation.type", "slow");
        activity?.SetTag("expected.duration", "2000ms");

        _logger.LogInformation("Slow endpoint called - simulating delay");

        // Create nested spans for different slow operations
        using (var dbActivity = _activitySource.StartActivity("slow.database.query", ActivityKind.Client))
        {
            dbActivity?.SetTag("db.query.duration_ms", 1000);
            await Task.Delay(1000);
            dbActivity?.SetStatus(ActivityStatusCode.Ok);
        }

        using (var apiActivity = _activitySource.StartActivity("slow.external.api", ActivityKind.Client))
        {
            apiActivity?.SetTag("api.call.duration_ms", 1000);
            await Task.Delay(1000);
            apiActivity?.SetStatus(ActivityStatusCode.Ok);
        }

        _logger.LogInformation("Slow operation completed");
        activity?.SetStatus(ActivityStatusCode.Ok);

        return Ok(new { message = "This took 2 seconds!" });
    }

    [HttpGet("api/error")]
    public IActionResult GetError()
    {
        var startTime = Stopwatch.GetTimestamp();

        using var activity = _activitySource.StartActivity("error-operation", ActivityKind.Server);

        try
        {
            _logger.LogWarning("Error endpoint called - throwing intentional error");

            activity?.SetTag("error.intentional", true);
            activity?.SetTag("error.type", "TestError");

            throw new Exception("Intentional error for testing traces");
        }
        catch (Exception ex)
        {
            // Manually record exception
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);

            _logger.LogError(ex, "Intentional error thrown: {ErrorMessage}", ex.Message);

            var duration = Stopwatch.GetElapsedTime(startTime).TotalMilliseconds;
            _requestCounter.Add(1,
                new KeyValuePair<string, object?>("endpoint", "/api/error"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 500));
            _requestDuration.Record(duration,
                new KeyValuePair<string, object?>("endpoint", "/api/error"),
                new KeyValuePair<string, object?>("method", "GET"),
                new KeyValuePair<string, object?>("status", 500));

            return StatusCode(500, new { error = ex.Message });
        }
    }
}
