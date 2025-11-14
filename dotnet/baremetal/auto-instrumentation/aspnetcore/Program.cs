var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure the HTTP request pipeline
app.MapControllers();
app.MapHealthChecks("/health");
app.MapHealthChecks("/ready");

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
Console.WriteLine("==============================================");
Console.WriteLine($"Server starting on port {port}");
Console.WriteLine("Auto-Instrumentation Mode");
Console.WriteLine("Try these endpoints:");
Console.WriteLine($"  http://localhost:{port}/");
Console.WriteLine($"  http://localhost:{port}/api/users/123");
Console.WriteLine($"  http://localhost:{port}/api/slow");
Console.WriteLine($"  http://localhost:{port}/api/error");
Console.WriteLine("==============================================");

app.Run($"http://0.0.0.0:{port}");
