FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY otel_config.py .

# Expose application port
EXPOSE 8080

# Run with Python (manual instrumentation configured in code)
CMD ["python", "app.py"]
