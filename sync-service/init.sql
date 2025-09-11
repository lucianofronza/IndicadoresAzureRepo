-- Initialize database for sync service
-- This script creates the necessary tables for the sync service

-- Create sync global config table
CREATE TABLE IF NOT EXISTS sync_global_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  enabled BOOLEAN DEFAULT true,
  interval_minutes INTEGER DEFAULT 30,
  max_concurrent_repos INTEGER DEFAULT 3,
  delay_between_repos_seconds INTEGER DEFAULT 30,
  max_retries INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 5,
  notification_enabled BOOLEAN DEFAULT true,
  notification_recipients TEXT[],
  azure_rate_limit_per_minute INTEGER DEFAULT 60,
  azure_burst_limit INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create scheduler status table
CREATE TABLE IF NOT EXISTS scheduler_status (
  id TEXT PRIMARY KEY DEFAULT 'scheduler',
  is_running BOOLEAN DEFAULT false,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  current_batch_id TEXT,
  total_repos_processed INTEGER DEFAULT 0,
  successful_syncs INTEGER DEFAULT 0,
  failed_syncs INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notification config table
CREATE TABLE IF NOT EXISTS notification_config (
  id TEXT PRIMARY KEY DEFAULT 'notifications',
  enabled BOOLEAN DEFAULT true,
  email_recipients TEXT[],
  slack_webhook_url TEXT,
  failure_threshold INTEGER DEFAULT 3,
  success_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create service API keys table
CREATE TABLE IF NOT EXISTS service_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  permissions TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Create scheduler logs table
CREATE TABLE IF NOT EXISTS scheduler_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create sync metrics table
CREATE TABLE IF NOT EXISTS sync_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER NOT NULL,
  records_processed INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_batch_id ON scheduler_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_created_at ON scheduler_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_level ON scheduler_logs(level);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_repository_id ON sync_metrics(repository_id);
CREATE INDEX IF NOT EXISTS idx_sync_metrics_created_at ON sync_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_metrics_status ON sync_metrics(status);

CREATE INDEX IF NOT EXISTS idx_service_api_keys_api_key ON service_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_service_api_keys_service_name ON service_api_keys(service_name);

-- Insert default configuration
INSERT INTO sync_global_config (id, enabled, interval_minutes, max_concurrent_repos, delay_between_repos_seconds, max_retries, retry_delay_minutes, notification_enabled, notification_recipients, azure_rate_limit_per_minute, azure_burst_limit)
VALUES ('global', true, 30, 3, 30, 3, 5, true, ARRAY[]::TEXT[], 60, 10)
ON CONFLICT (id) DO NOTHING;

-- Insert default scheduler status
INSERT INTO scheduler_status (id, is_running, total_repos_processed, successful_syncs, failed_syncs)
VALUES ('scheduler', false, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Insert default notification config
INSERT INTO notification_config (id, enabled, email_recipients, failure_threshold, success_notifications)
VALUES ('notifications', true, ARRAY[]::TEXT[], 3, false)
ON CONFLICT (id) DO NOTHING;

-- Insert default service API keys (these should be replaced with actual keys)
INSERT INTO service_api_keys (service_name, api_key, permissions, is_active)
VALUES 
  ('sync-service', 'sync-service-default-key', ARRAY['sync:admin'], true),
  ('backend', 'backend-default-key', ARRAY['sync:config:read', 'sync:config:write', 'sync:status:read', 'sync:scheduler:control', 'sync:monitor:read'], true)
ON CONFLICT (api_key) DO NOTHING;
