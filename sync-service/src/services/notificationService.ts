import { getPrisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { syncMetrics, recordNotification } from '@/utils/metrics';

export interface NotificationConfig {
  id: string;
  enabled: boolean;
  emailRecipients: string[];
  slackWebhookUrl?: string;
  failureThreshold: number;
  successNotifications: boolean;
}

export interface FailureNotificationData {
  batchId: string;
  failureCount: number;
  totalProcessed: number;
  recipients: string[];
}

export interface RepositoryFailureNotificationData {
  repositoryId: string;
  errorMessage: string;
  failureCount: number;
  batchId?: string;
}

export class NotificationService {
  private config: NotificationConfig | null = null;

  async getConfig(): Promise<NotificationConfig> {
    if (this.config) {
      return this.config;
    }

    const prisma = getPrisma();
    
    let config = await prisma.notificationConfig.findUnique({
      where: { id: 'notifications' }
    });

    if (!config) {
      // Create default config
      config = await prisma.notificationConfig.create({
        data: {
          id: 'notifications',
          enabled: process.env.NOTIFICATION_ENABLED === 'true',
          emailRecipients: process.env.NOTIFICATION_EMAILS?.split(',') || [],
          failureThreshold: 3,
          successNotifications: false
        }
      });
    }

    this.config = {
      id: config.id,
      enabled: config.enabled,
      emailRecipients: config.emailRecipients,
      slackWebhookUrl: config.slackWebhookUrl || undefined,
      failureThreshold: config.failureThreshold,
      successNotifications: config.successNotifications
    };

    return this.config;
  }

  async updateConfig(config: Partial<NotificationConfig>): Promise<NotificationConfig> {
    const prisma = getPrisma();
    
    const updatedConfig = await prisma.notificationConfig.upsert({
      where: { id: 'notifications' },
      update: {
        ...config,
        updatedAt: new Date()
      },
      create: {
        id: 'notifications',
        enabled: config.enabled ?? true,
        emailRecipients: config.emailRecipients ?? [],
        slackWebhookUrl: config.slackWebhookUrl,
        failureThreshold: config.failureThreshold ?? 3,
        successNotifications: config.successNotifications ?? false
      }
    });

    this.config = {
      id: updatedConfig.id,
      enabled: updatedConfig.enabled,
      emailRecipients: updatedConfig.emailRecipients,
      slackWebhookUrl: updatedConfig.slackWebhookUrl || undefined,
      failureThreshold: updatedConfig.failureThreshold,
      successNotifications: updatedConfig.successNotifications
    };

    return this.config;
  }

  async sendFailureNotification(data: FailureNotificationData): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled || data.recipients.length === 0) {
        return;
      }

      const subject = `Sync Service: ${data.failureCount} failures in batch ${data.batchId}`;
      const message = this.buildFailureEmailMessage(data);

      // Send email notifications
      if (config.emailRecipients.length > 0) {
        await this.sendEmailNotification({
          recipients: config.emailRecipients,
          subject,
          message
        });
      }

      // Send Slack notification if configured
      if (config.slackWebhookUrl) {
        await this.sendSlackNotification({
          webhookUrl: config.slackWebhookUrl,
          message: this.buildSlackFailureMessage(data)
        });
      }

      recordNotification('failure', 'success');

      logger.info('Failure notification sent', {
        batchId: data.batchId,
        failureCount: data.failureCount,
        recipients: data.recipients.length
      });

    } catch (error) {
      logger.error('Failed to send failure notification:', error);
      recordNotification('failure', 'failed');
    }
  }

  async sendRepositoryFailureNotification(data: RepositoryFailureNotificationData): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled || data.failureCount < config.failureThreshold) {
        return;
      }

      const subject = `Sync Service: Repository ${data.repositoryId} failing repeatedly`;
      const message = this.buildRepositoryFailureEmailMessage(data);

      // Send email notifications
      if (config.emailRecipients.length > 0) {
        await this.sendEmailNotification({
          recipients: config.emailRecipients,
          subject,
          message
        });
      }

      // Send Slack notification if configured
      if (config.slackWebhookUrl) {
        await this.sendSlackNotification({
          webhookUrl: config.slackWebhookUrl,
          message: this.buildSlackRepositoryFailureMessage(data)
        });
      }

      recordNotification('repository_failure', 'success');

      logger.info('Repository failure notification sent', {
        repositoryId: data.repositoryId,
        failureCount: data.failureCount
      });

    } catch (error) {
      logger.error('Failed to send repository failure notification:', error);
      recordNotification('repository_failure', 'failed');
    }
  }

  async sendSuccessNotification(batchId: string, successCount: number): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled || !config.successNotifications) {
        return;
      }

      const subject = `Sync Service: Batch ${batchId} completed successfully`;
      const message = this.buildSuccessEmailMessage(batchId, successCount);

      // Send email notifications
      if (config.emailRecipients.length > 0) {
        await this.sendEmailNotification({
          recipients: config.emailRecipients,
          subject,
          message
        });
      }

      recordNotification('success', 'success');

      logger.info('Success notification sent', {
        batchId,
        successCount
      });

    } catch (error) {
      logger.error('Failed to send success notification:', error);
      recordNotification('success', 'failed');
    }
  }

  private async sendEmailNotification(data: {
    recipients: string[];
    subject: string;
    message: string;
  }): Promise<void> {
    // For now, just log the email. In production, integrate with email service
    logger.info('Email notification would be sent:', {
      recipients: data.recipients,
      subject: data.subject,
      message: data.message.substring(0, 200) + '...'
    });

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // Example:
    // await emailService.send({
    //   to: data.recipients,
    //   subject: data.subject,
    //   html: data.message
    // });
  }

  private async sendSlackNotification(data: {
    webhookUrl: string;
    message: string;
  }): Promise<void> {
    try {
      const response = await fetch(data.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: data.message,
          username: 'Sync Service',
          icon_emoji: ':warning:'
        })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      logger.info('Slack notification sent successfully');

    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  private buildFailureEmailMessage(data: FailureNotificationData): string {
    return `
      <h2>Sync Service - Batch Failure Report</h2>
      <p><strong>Batch ID:</strong> ${data.batchId}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Failures:</strong> ${data.failureCount}</p>
      <p><strong>Total Processed:</strong> ${data.totalProcessed}</p>
      <p><strong>Success Rate:</strong> ${((data.totalProcessed - data.failureCount) / data.totalProcessed * 100).toFixed(1)}%</p>
      
      <h3>Action Required</h3>
      <p>Please check the sync service logs and repository configurations for the failed repositories.</p>
      
      <p>Best regards,<br>Sync Service</p>
    `;
  }

  private buildRepositoryFailureEmailMessage(data: RepositoryFailureNotificationData): string {
    return `
      <h2>Sync Service - Repository Failure Alert</h2>
      <p><strong>Repository ID:</strong> ${data.repositoryId}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Failure Count (24h):</strong> ${data.failureCount}</p>
      <p><strong>Last Error:</strong> ${data.errorMessage}</p>
      ${data.batchId ? `<p><strong>Batch ID:</strong> ${data.batchId}</p>` : ''}
      
      <h3>Action Required</h3>
      <p>This repository has failed ${data.failureCount} times in the last 24 hours. Please investigate:</p>
      <ul>
        <li>Repository configuration and credentials</li>
        <li>Azure DevOps API access</li>
        <li>Network connectivity</li>
        <li>Repository permissions</li>
      </ul>
      
      <p>Best regards,<br>Sync Service</p>
    `;
  }

  private buildSuccessEmailMessage(batchId: string, successCount: number): string {
    return `
      <h2>Sync Service - Batch Success Report</h2>
      <p><strong>Batch ID:</strong> ${batchId}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Successful Syncs:</strong> ${successCount}</p>
      
      <p>All repositories in this batch were synchronized successfully.</p>
      
      <p>Best regards,<br>Sync Service</p>
    `;
  }

  private buildSlackFailureMessage(data: FailureNotificationData): string {
    return `🚨 *Sync Service Alert*\n\n` +
           `*Batch:* ${data.batchId}\n` +
           `*Failures:* ${data.failureCount}/${data.totalProcessed}\n` +
           `*Success Rate:* ${((data.totalProcessed - data.failureCount) / data.totalProcessed * 100).toFixed(1)}%\n` +
           `*Time:* ${new Date().toISOString()}\n\n` +
           `Please check the sync service logs for details.`;
  }

  private buildSlackRepositoryFailureMessage(data: RepositoryFailureNotificationData): string {
    return `⚠️ *Repository Failure Alert*\n\n` +
           `*Repository:* ${data.repositoryId}\n` +
           `*Failures (24h):* ${data.failureCount}\n` +
           `*Error:* ${data.errorMessage}\n` +
           `*Time:* ${new Date().toISOString()}\n\n` +
           `This repository needs immediate attention.`;
  }
}
