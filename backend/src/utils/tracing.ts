import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'indicadores-azure-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Start the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

// Get tracer
export const tracer = trace.getTracer('indicadores-azure-backend');

// Tracing middleware for Express
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'http.request_id': (req as any).requestId,
      'user.id': (req as any).userId,
    },
  });

  // Add span to request context
  const ctx = trace.setSpan(context.active(), span);
  context.with(ctx, () => {
    // Override res.end to end span
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_size': chunk ? chunk.length : 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  });
};

// Helper function to create spans for database operations
export const createDbSpan = (operation: string, table: string, query?: string) => {
  return tracer.startSpan(`db.${operation}`, {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.table': table,
      'db.query': query,
    },
  });
};

// Helper function to create spans for Azure API calls
export const createAzureSpan = (endpoint: string, method: string) => {
  return tracer.startSpan(`azure.${method}`, {
    attributes: {
      'http.method': method,
      'http.url': endpoint,
      'azure.endpoint': endpoint,
    },
  });
};

// Helper function to create spans for sync operations
export const createSyncSpan = (repositoryId: string, operation: string) => {
  return tracer.startSpan(`sync.${operation}`, {
    attributes: {
      'sync.repository_id': repositoryId,
      'sync.operation': operation,
    },
  });
};

// Helper function to create spans for business operations
export const createBusinessSpan = (operation: string, entity: string, id?: string) => {
  return tracer.startSpan(`business.${operation}`, {
    attributes: {
      'business.operation': operation,
      'business.entity': entity,
      'business.entity_id': id,
    },
  });
};

// Decorator for automatic tracing
export const traced = (operation: string) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(`${operation}.${propertyName}`, {
        attributes: {
          'method.name': propertyName,
          'method.class': target.constructor.name,
        },
      });

      try {
        const result = await method.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    };
  };
};

// Helper for async operations with tracing
export const withSpan = async <T>(
  operation: string,
  fn: (span: any) => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> => {
  const span = tracer.startSpan(operation, { attributes });
  
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
};

// Helper for adding events to spans
export const addSpanEvent = (span: any, name: string, attributes: Record<string, any> = {}) => {
  span.addEvent(name, attributes);
};

// Helper for adding attributes to spans
export const addSpanAttributes = (span: any, attributes: Record<string, any>) => {
  span.setAttributes(attributes);
};

// Helper for getting current span
export const getCurrentSpan = () => {
  return trace.getSpan(context.active());
};

// Helper for getting trace ID
export const getTraceId = () => {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
};

// Helper for getting span ID
export const getSpanId = () => {
  const span = getCurrentSpan();
  return span?.spanContext().spanId;
};

// Helper for creating child spans
export const createChildSpan = (name: string, attributes: Record<string, any> = {}) => {
  const parentSpan = getCurrentSpan();
  if (parentSpan) {
    return tracer.startSpan(name, { attributes }, trace.setSpan(context.active(), parentSpan));
  }
  return tracer.startSpan(name, { attributes });
};

export default sdk;
