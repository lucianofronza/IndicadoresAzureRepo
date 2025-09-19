import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { logger } from '../utils/logger';

export interface SyncConfig {
  sync: {
    defaultIntervalMinutes: number;
    maxRetries: number;
    retryDelayMinutes: number;
    maxConcurrentRepos: number;
    delayBetweenReposSeconds: number;
    azure: {
      baseUrl: string;
      rateLimitPerMinute: number;
      burstLimit: number;
    };
    notifications: {
      enabled: boolean;
      emails: string[];
    };
    logging: {
      level: string;
      enableMetrics: boolean;
    };
  };
  repositories: any[];
  scheduler: {
    enabled: boolean;
    lastRun: string | null;
    nextRun: string | null;
  };
}

export class ConfigService {
  private configPath: string;
  private config: SyncConfig | null = null;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'sync-config.yaml');
  }

  async loadConfig(): Promise<SyncConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = yaml.load(configData) as SyncConfig;
      logger.info('Configuração carregada com sucesso');
      return this.config;
    } catch (error) {
      logger.error('Erro ao carregar configuração:', error);
      throw error;
    }
  }

  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('Nenhuma configuração carregada');
    }

    try {
      const configData = yaml.dump(this.config, { indent: 2 });
      await fs.writeFile(this.configPath, configData, 'utf-8');
      logger.info('Configuração salva com sucesso');
    } catch (error) {
      logger.error('Erro ao salvar configuração:', error);
      throw error;
    }
  }

  getConfig(): SyncConfig {
    if (!this.config) {
      throw new Error('Configuração não carregada. Execute loadConfig() primeiro.');
    }
    return this.config;
  }

  updateConfig(updates: Partial<SyncConfig>): void {
    if (!this.config) {
      throw new Error('Configuração não carregada');
    }
    this.config = { ...this.config, ...updates };
    // Salvar no arquivo após atualizar
    this.saveConfig().catch(error => {
      logger.error('Erro ao salvar configuração após atualização:', error);
    });
  }

  // Métodos específicos para configurações
  getDefaultInterval(): number {
    return this.getConfig().sync.defaultIntervalMinutes;
  }

  getMaxRetries(): number {
    return this.getConfig().sync.maxRetries;
  }

  getAzureConfig() {
    return this.getConfig().sync.azure;
  }

  getNotificationConfig() {
    return this.getConfig().sync.notifications;
  }

  isSchedulerEnabled(): boolean {
    return this.getConfig().scheduler.enabled;
  }

  setSchedulerEnabled(enabled: boolean): void {
    this.updateConfig({
      scheduler: {
        ...this.getConfig().scheduler,
        enabled
      }
    });
  }

  updateSchedulerStatus(lastRun: string | null, nextRun: string | null): void {
    this.updateConfig({
      scheduler: {
        ...this.getConfig().scheduler,
        lastRun,
        nextRun
      }
    });
  }

  addRepository(repo: any): void {
    const config = this.getConfig();
    config.repositories.push(repo);
    this.updateConfig({ repositories: config.repositories });
  }

  removeRepository(repoId: string): void {
    const config = this.getConfig();
    config.repositories = config.repositories.filter((repo: any) => repo.id !== repoId);
    this.updateConfig({ repositories: config.repositories });
  }

  getRepositories(): any[] {
    return this.getConfig().repositories;
  }
}

export const configService = new ConfigService();
