using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace DotnetApp.Services;

public static class OpenTelemetryConfig
{
    public static void Configure(IServiceCollection services)
    {
        // Get configuration from environment or use defaults
        var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "dotnet-aspnetcore-k8s-manual";
        var serviceVersion = Environment.GetEnvironmentVariable("OTEL_SERVICE_VERSION") ?? "1.0.0";
        var serviceNamespace = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAMESPACE");

        var tracesEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
            ?? Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")
            ?? "http://localhost:4338";
        var metricsEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT")
            ?? "http://localhost:4318";
        var logsEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT")
            ?? "http://localhost:4328";

        // Create resource with service information
        var resourceBuilder = ResourceBuilder.CreateDefault()
            .AddService(serviceName: serviceName, serviceVersion: serviceVersion);

        if (!string.IsNullOrEmpty(serviceNamespace))
        {
            resourceBuilder.AddAttributes(new[]
            {
                new KeyValuePair<string, object>("service.namespace", serviceNamespace)
            });
        }

        // Configure OpenTelemetry with manual instrumentation
        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(serviceName: serviceName, serviceVersion: serviceVersion))
            .WithTracing(tracing =>
            {
                tracing
                    .AddSource("DotnetApp.Manual")
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.EnrichWithHttpRequest = (activity, httpRequest) =>
                        {
                            activity.SetTag("custom.http.instrumentation", "manual");
                        };
                        options.EnrichWithHttpResponse = (activity, httpResponse) =>
                        {
                            activity.SetTag("http.response.status_code", httpResponse.StatusCode);
                        };
                    })
                    .AddHttpClientInstrumentation(options =>
                    {
                        options.RecordException = true;
                    })
                    .AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(tracesEndpoint);
                        options.Protocol = OtlpExportProtocol.HttpProtobuf;
                    });
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddMeter("DotnetApp.Manual")
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddProcessInstrumentation()
                    .AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(metricsEndpoint);
                        options.Protocol = OtlpExportProtocol.HttpProtobuf;
                    });
            });

        // Configure logging to export to OTLP
        services.AddLogging(logging =>
        {
            logging.AddOpenTelemetry(options =>
            {
                options.SetResourceBuilder(resourceBuilder);
                options.IncludeFormattedMessage = true;
                options.IncludeScopes = true;
                options.ParseStateValues = true;
                options.AddOtlpExporter(otlpOptions =>
                {
                    otlpOptions.Endpoint = new Uri(logsEndpoint);
                    otlpOptions.Protocol = OtlpExportProtocol.HttpProtobuf;
                });
            });
        });

        Console.WriteLine("=== OpenTelemetry Manual Instrumentation Configured ===");
        Console.WriteLine($"Service Name: {serviceName}");
        Console.WriteLine($"Service Version: {serviceVersion}");
        Console.WriteLine($"Traces Endpoint: {tracesEndpoint}");
        Console.WriteLine($"Metrics Endpoint: {metricsEndpoint}");
        Console.WriteLine($"Logs Endpoint: {logsEndpoint}");
        Console.WriteLine("=======================================================");
    }
}
