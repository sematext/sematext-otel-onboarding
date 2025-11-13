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

# Stage 2: Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy the application from build stage
COPY --from=build /app/publish .

# Expose port
EXPOSE 8080

# Set user to non-root
USER 1000

# Start the application
ENTRYPOINT ["dotnet", "dotnet-app.dll"]
