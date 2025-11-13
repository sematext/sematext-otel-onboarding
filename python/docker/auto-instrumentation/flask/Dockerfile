FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Expose application port
EXPOSE 8080

# Run with OpenTelemetry auto-instrumentation
CMD ["opentelemetry-instrument", "python", "app.py"]
