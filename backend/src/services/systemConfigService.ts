import { prisma } from '@/config/database';
import { encrypt, decrypt } from '@/utils/encryption';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/middlewares/errorHandler';

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemConfigData {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
}

export interface UpdateSystemConfigData {
  value?: string;
  description?: string;
  isEncrypted?: boolean;
}

export class SystemConfigService {
  async getAllConfigs(): Promise<SystemConfig[]> {
    try {
      const configs = await prisma.systemConfig.findMany({
        orderBy: { key: 'asc' },
      });

      return configs.map(config => ({
        ...config,
        value: config.isEncrypted ? this.maskValue(config.value) : config.value,
      }));
    } catch (error) {
      logger.error('Failed to get system configs:', error);
      throw new Error('Failed to retrieve system configurations');
    }
  }

  async getConfigByKey(key: string): Promise<SystemConfig | null> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!config) {
        return null;
      }

      return {
        ...config,
        value: config.isEncrypted ? this.maskValue(config.value) : config.value,
      };
    } catch (error) {
      logger.error('Failed to get system config by key:', error);
      throw new Error('Failed to retrieve system configuration');
    }
  }

  async getDecryptedValue(key: string): Promise<string | null> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!config) {
        return null;
      }

      return config.isEncrypted ? decrypt(config.value) : config.value;
    } catch (error) {
      logger.error('Failed to get decrypted config value:', error);
      throw new Error('Failed to retrieve decrypted configuration value');
    }
  }

  async createConfig(data: CreateSystemConfigData): Promise<SystemConfig> {
    try {
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key: data.key },
      });

      if (existingConfig) {
        throw new ValidationError(`Configuration with key '${data.key}' already exists`);
      }

      const valueToStore = data.isEncrypted ? encrypt(data.value) : data.value;

      const config = await prisma.systemConfig.create({
        data: {
          key: data.key,
          value: valueToStore,
          description: data.description,
          isEncrypted: data.isEncrypted || false,
        },
      });

      logger.info({
        configKey: data.key,
        isEncrypted: data.isEncrypted,
      }, 'System configuration created successfully');

      return {
        ...config,
        value: data.isEncrypted ? this.maskValue(valueToStore) : data.value,
      };
    } catch (error) {
      logger.error('Failed to create system config:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Failed to create system configuration');
    }
  }

  async updateConfig(key: string, data: UpdateSystemConfigData): Promise<SystemConfig> {
    try {
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!existingConfig) {
        throw new NotFoundError(`Configuration with key '${key}' not found`);
      }

      const updateData: any = {};
      
      if (data.value !== undefined) {
        const currentValue = existingConfig.isEncrypted 
          ? decrypt(existingConfig.value) 
          : existingConfig.value;
        
        if (currentValue !== data.value) {
          updateData.value = data.isEncrypted ? encrypt(data.value) : data.value;
        }
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.isEncrypted !== undefined) {
        updateData.isEncrypted = data.isEncrypted;
        
        if (data.value !== undefined) {
          updateData.value = data.isEncrypted ? encrypt(data.value) : data.value;
        }
      }

      const config = await prisma.systemConfig.update({
        where: { key },
        data: updateData,
      });

      logger.info({
        configKey: key,
        isEncrypted: config.isEncrypted,
      }, 'System configuration updated successfully');

      return {
        ...config,
        value: config.isEncrypted ? this.maskValue(config.value) : config.value,
      };
    } catch (error) {
      logger.error('Failed to update system config:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Failed to update system configuration');
    }
  }

  async deleteConfig(key: string): Promise<void> {
    try {
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!existingConfig) {
        throw new NotFoundError(`Configuration with key '${key}' not found`);
      }

      await prisma.systemConfig.delete({
        where: { key },
      });

      logger.info({
        configKey: key,
      }, 'System configuration deleted successfully');
    } catch (error) {
      logger.error('Failed to delete system config:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to delete system configuration');
    }
  }

  async getAzureDevOpsConfig(): Promise<{ organization: string; personalAccessToken: string } | null> {
    try {
      const organization = await this.getDecryptedValue('azure_devops_organization');
      const personalAccessToken = await this.getDecryptedValue('azure_devops_personal_access_token');

      if (!organization || !personalAccessToken) {
        return null;
      }

      return {
        organization,
        personalAccessToken,
      };
    } catch (error) {
      logger.error('Failed to get Azure DevOps config:', error);
      return null;
    }
  }

  async setAzureDevOpsConfig(organization: string, personalAccessToken: string): Promise<void> {
    try {
      await this.upsertConfig('azure_devops_organization', organization, 'Azure DevOps Organization Name', false);
      await this.upsertConfig('azure_devops_personal_access_token', personalAccessToken, 'Azure DevOps Personal Access Token', true);

      logger.info('Azure DevOps configuration updated successfully');
    } catch (error) {
      logger.error('Failed to set Azure DevOps config:', error);
      throw new Error('Failed to update Azure DevOps configuration');
    }
  }

  private async upsertConfig(key: string, value: string, description: string, isEncrypted: boolean): Promise<void> {
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (existingConfig) {
      await this.updateConfig(key, {
        value,
        description,
        isEncrypted,
      });
    } else {
      await this.createConfig({
        key,
        value,
        description,
        isEncrypted,
      });
    }
  }

  private maskValue(value: string): string {
    if (!value || value.length < 8) {
      return '****';
    }
    return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
  }
}
