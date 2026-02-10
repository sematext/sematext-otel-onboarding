FROM php:8.3-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install OpenTelemetry PHP extension for auto-instrumentation hooks
RUN pecl install opentelemetry && docker-php-ext-enable opentelemetry

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /app

# Copy composer files and install dependencies
COPY composer.json .
RUN composer install --no-dev --no-scripts --optimize-autoloader

# Copy application code
COPY . .

# Create required Laravel directories
RUN mkdir -p bootstrap/cache storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs \
    && chmod -R 775 bootstrap/cache storage

# Generate autoload files
RUN composer dump-autoload --optimize

# Expose application port
EXPOSE 8080

# Run with Laravel's built-in server
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8080"]
