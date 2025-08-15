// Global type definitions
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL: string;
      REDIS_URL: string;
      AZURE_CLIENT_ID: string;
      AZURE_CLIENT_SECRET: string;
      AZURE_REDIRECT_URI: string;
      JWT_SECRET: string;
      ENCRYPTION_KEY: string;
      LOG_LEVEL?: string;
      FRONTEND_URL?: string;
      HOSTNAME?: string;
      OTEL_EXPORTER_OTLP_ENDPOINT?: string;
    }
  }
}

export {};
