# Stage 1: Build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY dotnet-app.csproj .
RUN dotnet restore

# Copy the rest of the application code
COPY . .

# Build the application
RUN dotnet publish -c Release -o /app/publish

# Stage 2: Download OpenTelemetry .NET Automatic Instrumentation
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS otel-setup
WORKDIR /otel

# Install required tools
RUN apt-get update && \
    apt-get install -y curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Download and extract OpenTelemetry .NET automatic instrumentation
RUN OTEL_VERSION=v1.12.0 && \
    curl -L -o otel-dotnet-auto.zip \
    https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/download/${OTEL_VERSION}/opentelemetry-dotnet-instrumentation-linux-glibc.zip && \
    unzip otel-dotnet-auto.zip -d /otel && \
    rm otel-dotnet-auto.zip

# Stage 3: Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy the application from build stage
COPY --from=build /app/publish .

# Copy OpenTelemetry automatic instrumentation
COPY --from=otel-setup /otel /otel-dotnet-auto

# Set environment variables for OpenTelemetry automatic instrumentation
ENV CORECLR_ENABLE_PROFILING=1
ENV CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
ENV CORECLR_PROFILER_PATH=/otel-dotnet-auto/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so
ENV DOTNET_ADDITIONAL_DEPS=/otel-dotnet-auto/AdditionalDeps
ENV DOTNET_SHARED_STORE=/otel-dotnet-auto/store
ENV DOTNET_STARTUP_HOOKS=/otel-dotnet-auto/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll
ENV OTEL_DOTNET_AUTO_HOME=/otel-dotnet-auto

# Expose port
EXPOSE 8080

# Set user to non-root
USER 1000

# Start the application
ENTRYPOINT ["dotnet", "dotnet-app.dll"]
