import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { SystemConfigService } from '@/services/systemConfigService';

const router = Router();
const systemConfigService = new SystemConfigService();

// Get all system configurations
router.get('/', asyncHandler(async (req, res) => {
  const configs = await systemConfigService.getAllConfigs();
  
  logger.info({
    count: configs.length,
    requestId: req.requestId,
  }, 'System configurations retrieved successfully');

  res.json({
    success: true,
    data: configs,
    message: 'System configurations retrieved successfully',
  });
}));

// Get system configuration by key
router.get('/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  const config = await systemConfigService.getConfigByKey(key);
  
  if (!config) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `Configuration with key '${key}' not found`,
    });
  }

  logger.info({
    configKey: key,
    requestId: req.requestId,
  }, 'System configuration retrieved successfully');

  res.json({
    success: true,
    data: config,
    message: 'System configuration retrieved successfully',
  });
}));

// Create new system configuration
router.post('/', asyncHandler(async (req, res) => {
  const { key, value, description, isEncrypted } = req.body;

  if (!key || !value) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Key and value are required',
    });
  }

  const config = await systemConfigService.createConfig({
    key,
    value,
    description,
    isEncrypted,
  });

  logger.info({
    configKey: key,
    isEncrypted,
    requestId: req.requestId,
  }, 'System configuration created successfully');

  res.status(201).json({
    success: true,
    data: config,
    message: 'System configuration created successfully',
  });
}));

// Update system configuration
router.put('/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, description, isEncrypted } = req.body;

  const config = await systemConfigService.updateConfig(key, {
    value,
    description,
    isEncrypted,
  });

  logger.info({
    configKey: key,
    requestId: req.requestId,
  }, 'System configuration updated successfully');

  res.json({
    success: true,
    data: config,
    message: 'System configuration updated successfully',
  });
}));

// Delete system configuration
router.delete('/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;

  await systemConfigService.deleteConfig(key);

  logger.info({
    configKey: key,
    requestId: req.requestId,
  }, 'System configuration deleted successfully');

  res.json({
    success: true,
    message: 'System configuration deleted successfully',
  });
}));

// Azure DevOps specific endpoints
router.get('/azure-devops/config', asyncHandler(async (req, res) => {
  const config = await systemConfigService.getAzureDevOpsConfig();
  
  if (!config) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Azure DevOps configuration not found',
    });
  }

  logger.info({
    organization: config.organization,
    requestId: req.requestId,
  }, 'Azure DevOps configuration retrieved successfully');

  res.json({
    success: true,
    data: {
      organization: config.organization,
      personalAccessToken: '****' + config.personalAccessToken.substring(config.personalAccessToken.length - 4),
    },
    message: 'Azure DevOps configuration retrieved successfully',
  });
}));

router.post('/azure-devops/config', asyncHandler(async (req, res) => {
  const { organization, personalAccessToken } = req.body;

  if (!organization || !personalAccessToken) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Organization and Personal Access Token are required',
    });
  }

  await systemConfigService.setAzureDevOpsConfig(organization, personalAccessToken);

  logger.info({
    organization,
    requestId: req.requestId,
  }, 'Azure DevOps configuration updated successfully');

  res.json({
    success: true,
    message: 'Azure DevOps configuration updated successfully',
  });
}));

export default router;
