import os
import time
from flask import Flask, jsonify, request
from opentelemetry import trace, metrics
from opentelemetry.trace import Status, StatusCode
from opentelemetry.sdk.metrics import Counter, Histogram, UpDownCounter
from otel_config import configure_opentelemetry
import logging

# Configure OpenTelemetry before creating Flask app
configure_opentelemetry()

app = Flask(__name__)
port = int(os.getenv('PORT', 8080))

# Get tracer for manual span creation
tracer = trace.get_tracer('python-flask-manual', '1.0.0')

# Get meter for manual metrics creation
meter = metrics.get_meter('python-flask-manual', '1.0.0')

# Create custom metrics
request_counter = meter.create_counter(
    name='http.server.requests',
    description='Total number of HTTP requests',
    unit='1'
)

request_duration = meter.create_histogram(
    name='http.server.duration',
    description='HTTP request duration',
    unit='ms'
)

active_requests = meter.create_up_down_counter(
    name='http.server.active_requests',
    description='Number of active HTTP requests',
    unit='1'
)

# Configure logging for structured logs
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Helper function to emit structured logs with trace correlation
def emit_log(level, message, **kwargs):
    """Emit a log with trace correlation"""
    span = trace.get_current_span()
    if span and span.is_recording():
        span_context = span.get_span_context()
        kwargs['trace_id'] = format(span_context.trace_id, '032x')
        kwargs['span_id'] = format(span_context.span_id, '016x')
        kwargs['trace_flags'] = span_context.trace_flags

    log_method = getattr(logger, level.lower(), logger.info)
    log_method(f"{message} {kwargs}")

@app.route('/health')
def health():
    return 'healthy'

@app.route('/ready')
def ready():
    return 'ready'

@app.route('/')
def root():
    start_time = time.time()

    # Increment active requests metric
    active_requests.add(1, {'endpoint': '/', 'method': 'GET'})

    # Manual span creation
    with tracer.start_as_current_span('handle-root-request') as span:
        span.set_attributes({
            'endpoint': '/',
            'method': 'GET',
            'instrumentation.type': 'manual'
        })

        # Emit custom log
        emit_log('info', 'Root endpoint accessed',
                 endpoint='/', method='GET',
                 user_agent=request.headers.get('User-Agent'))

        span.set_status(Status(StatusCode.OK))

    # Record metrics
    duration = (time.time() - start_time) * 1000
    request_counter.add(1, {'endpoint': '/', 'method': 'GET', 'status': 200})
    request_duration.record(duration, {'endpoint': '/', 'method': 'GET', 'status': 200})
    active_requests.add(-1, {'endpoint': '/', 'method': 'GET'})

    return jsonify({
        'message': 'Hello from Sematext OpenTelemetry Example!',
        'service': os.getenv('OTEL_SERVICE_NAME', 'python-flask-k8s-manual'),
        'instrumentation': 'manual'
    })

@app.route('/users/<user_id>')
def get_user(user_id):
    start_time = time.time()

    active_requests.add(1, {'endpoint': '/users/<id>', 'method': 'GET'})

    # Create parent span for the entire operation
    with tracer.start_as_current_span('get-user-operation') as parent_span:
        parent_span.set_attributes({
            'user.id': user_id,
            'operation': 'get_user'
        })

        try:
            emit_log('info', f'Fetching user with ID: {user_id}',
                     user_id=user_id, endpoint='/users/<id>')

            # Create nested span for database lookup
            with tracer.start_as_current_span('database.lookup') as db_span:
                db_span.set_attributes({
                    'db.system': 'postgresql',
                    'db.operation': 'SELECT',
                    'db.table': 'users',
                    'user.id': user_id
                })

                # Simulate database call
                time.sleep(0.1)

                emit_log('debug', f'Database query completed for user {user_id}',
                         user_id=user_id, db_duration_ms=100)

                db_span.set_status(Status(StatusCode.OK))

            # Create nested span for business logic
            with tracer.start_as_current_span('process.user.data') as process_span:
                process_span.set_attributes({
                    'operation': 'transform',
                    'user.id': user_id
                })

                # Simulate processing
                time.sleep(0.05)

                emit_log('debug', f'User data processed for {user_id}',
                         user_id=user_id, processing_duration_ms=50)

                process_span.set_status(Status(StatusCode.OK))

            parent_span.set_status(Status(StatusCode.OK))

            # Record metrics
            duration = (time.time() - start_time) * 1000
            request_counter.add(1, {'endpoint': '/users/<id>', 'method': 'GET', 'status': 200})
            request_duration.record(duration, {'endpoint': '/users/<id>', 'method': 'GET', 'status': 200})
            active_requests.add(-1, {'endpoint': '/users/<id>', 'method': 'GET'})

            return jsonify({
                'id': user_id,
                'name': f'User {user_id}',
                'email': f'user{user_id}@example.com'
            })

        except Exception as error:
            parent_span.record_exception(error)
            parent_span.set_status(Status(StatusCode.ERROR, str(error)))

            emit_log('error', f'Error fetching user: {str(error)}',
                     user_id=user_id, error_message=str(error))

            duration = (time.time() - start_time) * 1000
            request_counter.add(1, {'endpoint': '/users/<id>', 'method': 'GET', 'status': 500})
            request_duration.record(duration, {'endpoint': '/users/<id>', 'method': 'GET', 'status': 500})
            active_requests.add(-1, {'endpoint': '/users/<id>', 'method': 'GET'})

            return jsonify({'error': str(error)}), 500

@app.route('/slow')
def slow():
    # Manual span with nested operations
    with tracer.start_as_current_span('slow-operation') as span:
        span.set_attributes({
            'operation.type': 'slow',
            'expected.duration': '2000ms'
        })

        emit_log('info', 'Slow endpoint called - simulating delay')

        # Create nested spans for different slow operations
        with tracer.start_as_current_span('slow.database.query') as db_span:
            db_span.set_attribute('db.query.duration_ms', 1000)
            time.sleep(1)
            db_span.set_status(Status(StatusCode.OK))

        with tracer.start_as_current_span('slow.external.api') as api_span:
            api_span.set_attribute('api.call.duration_ms', 1000)
            time.sleep(1)
            api_span.set_status(Status(StatusCode.OK))

        emit_log('info', 'Slow operation completed')
        span.set_status(Status(StatusCode.OK))

    return jsonify({'message': 'This took 2 seconds!'})

@app.route('/error')
def error():
    start_time = time.time()
    active_requests.add(1, {'endpoint': '/error', 'method': 'GET'})

    with tracer.start_as_current_span('error-operation') as span:
        try:
            emit_log('warn', 'Error endpoint called - throwing intentional error',
                     endpoint='/error', test=True)

            span.set_attributes({
                'error.intentional': True,
                'error.type': 'TestError'
            })

            raise Exception('Intentional error for testing traces')

        except Exception as error:
            # Manually record exception
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))

            emit_log('error', 'Intentional error thrown',
                     error_message=str(error), error_type='TestError', endpoint='/error')

            duration = (time.time() - start_time) * 1000
            request_counter.add(1, {'endpoint': '/error', 'method': 'GET', 'status': 500})
            request_duration.record(duration, {'endpoint': '/error', 'method': 'GET', 'status': 500})
            active_requests.add(-1, {'endpoint': '/error', 'method': 'GET'})

            return jsonify({'error': str(error)}), 500

@app.errorhandler(Exception)
def handle_exception(error):
    logger.error(f'Error occurred: {str(error)}')

    span = trace.get_current_span()
    if span and span.is_recording():
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR, str(error)))

    return jsonify({'error': str(error)}), 500

if __name__ == '__main__':
    print('==============================================')
    print(f'Server starting on port {port}')
    print('Manual Instrumentation Mode')
    print('Try these endpoints:')
    print(f'  http://localhost:{port}/')
    print(f'  http://localhost:{port}/users/123')
    print(f'  http://localhost:{port}/slow')
    print(f'  http://localhost:{port}/error')
    print('==============================================')
    app.run(host='0.0.0.0', port=port, debug=False)
