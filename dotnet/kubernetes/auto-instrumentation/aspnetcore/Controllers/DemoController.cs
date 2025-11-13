using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace DotnetApp.Controllers;

[ApiController]
[Route("/")]
public class DemoController : ControllerBase
{
    private readonly ILogger<DemoController> _logger;

    public DemoController(ILogger<DemoController> logger)
    {
        _logger = logger;
    }

    [HttpGet]
    public IActionResult GetRoot()
    {
        _logger.LogInformation("Root endpoint accessed");

        // Get current activity (span) created by auto-instrumentation
        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("endpoint", "/");
            activity.SetTag("method", "GET");
        }

        return Ok(new
        {
            message = "Hello from Sematext OpenTelemetry Example!",
            service = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "dotnet-aspnetcore-k8s-auto",
            instrumentation = "auto"
        });
    }

    [HttpGet("api/users/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        _logger.LogInformation("Fetching user with ID: {UserId}", id);

        // Get current activity and add custom tags
        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("user.id", id);
            activity.SetTag("operation", "get_user");
        }

        // Simulate database call
        await Task.Delay(100);

        _logger.LogInformation("Successfully retrieved user {UserId}", id);

        return Ok(new
        {
            id = id,
            name = $"User {id}",
            email = $"user{id}@example.com"
        });
    }

    [HttpGet("api/slow")]
    public async Task<IActionResult> GetSlow()
    {
        _logger.LogInformation("Slow endpoint called - simulating delay");

        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("operation.type", "slow");
        }

        // Simulate slow operation
        await Task.Delay(2000);

        _logger.LogInformation("Slow operation completed");

        return Ok(new { message = "This took 2 seconds!" });
    }

    [HttpGet("api/error")]
    public IActionResult GetError()
    {
        _logger.LogError("Error endpoint called - throwing intentional error");

        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("error.intentional", true);
        }

        throw new Exception("Intentional error for testing traces");
    }
}
