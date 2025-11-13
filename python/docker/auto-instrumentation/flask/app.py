import os
import time
from flask import Flask, jsonify, request
from opentelemetry import trace

app = Flask(__name__)
port = int(os.getenv('PORT', 8080))

# Get tracer for adding custom attributes to auto-instrumented spans
tracer = trace.get_tracer(__name__)

@app.route('/health')
def health():
    return 'healthy'

@app.route('/ready')
def ready():
    return 'ready'

@app.route('/')
def root():
    print('Root endpoint accessed')

    # Get current span (created automatically by auto-instrumentation)
    span = trace.get_current_span()
    if span:
        span.set_attribute('custom.attribute', 'root-endpoint')

    return jsonify({
        'message': 'Hello from Sematext OpenTelemetry Example!',
        'service': os.getenv('OTEL_SERVICE_NAME', 'python-flask-docker-auto'),
        'instrumentation': 'auto'
    })

@app.route('/users/<user_id>')
def get_user(user_id):
    print(f'Fetching user with ID: {user_id}')

    # Get current span and add custom attributes
    span = trace.get_current_span()
    if span:
        span.set_attributes({
            'user.id': user_id,
            'operation': 'get_user'
        })

    # Simulate database call
    time.sleep(0.1)

    print(f'Successfully retrieved user {user_id}')

    return jsonify({
        'id': user_id,
        'name': f'User {user_id}',
        'email': f'user{user_id}@example.com'
    })

@app.route('/slow')
def slow():
    print('Slow endpoint called - simulating delay')

    span = trace.get_current_span()
    if span:
        span.set_attribute('operation.type', 'slow')

    # Simulate slow operation
    time.sleep(2)

    print('Slow operation completed')
    return jsonify({'message': 'This took 2 seconds!'})

@app.route('/error')
def error():
    print('Error endpoint called - throwing intentional error')

    span = trace.get_current_span()
    if span:
        span.set_attribute('error.intentional', True)

    raise Exception('Intentional error for testing traces')

@app.errorhandler(Exception)
def handle_exception(error):
    print(f'Error occurred: {str(error)}')

    span = trace.get_current_span()
    if span:
        span.record_exception(error)
        span.set_status(trace.Status(trace.StatusCode.ERROR, str(error)))

    return jsonify({'error': str(error)}), 500

if __name__ == '__main__':
    print('==============================================')
    print(f'Server starting on port {port}')
    print('Try these endpoints:')
    print(f'  http://localhost:{port}/')
    print(f'  http://localhost:{port}/users/123')
    print(f'  http://localhost:{port}/slow')
    print(f'  http://localhost:{port}/error')
    print('==============================================')
    app.run(host='0.0.0.0', port=port, debug=False)
