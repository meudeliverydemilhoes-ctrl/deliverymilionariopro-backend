const cron = require('node-cron');
const db = require('../config/database');
const evolutionService = require('./evolution.service');

/**
 * Follow-up Service
 * Manages follow-up alerts and checks for pending responses
 */
class FollowupService {
  /**
   * Initialize Follow-up Service
   */
  constructor() {
    this.cronJob = null;
  }

  /**
   * Start the follow-up checker scheduler
   * Runs every 5 minutes by default
   * @param {string} schedule - Cron expression (default: '*/5 * * * *' = every 5 minutes)
   */
  start(schedule = '*/5 * * * *') {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = cron.schedule(schedule, async () => {
      try {
        await this.checkPendingFollowups();
      } catch (error) {
        console.error('Follow-up check error:', error.message);
      }
    });

    console.log('Follow-up service started');
  }

  /**
   * Stop the follow-up checker scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Follow-up service stopped');
    }
  }

  /**
   * Check for pending follow-ups and create alerts
   * @returns {Promise<number>} Number of alerts created
   */
  async checkPendingFollowups() {
    try {
      const configs = await db('companies').select('id', 'followup_hours').where('active', true);

      let alertsCreated = 0;

      for (const company of configs) {
        const followupHours = company.followup_hours || 24;
        const cutoffTime = new Date(Date.now() - followupHours * 60 * 60 * 1000);

        // Find conversations where last message is from lead and hasn't been responded to
        const pendingLeads = await db('leads')
          .where('company_id', company.id)
          .where('status', '!=', 'closed')
          .where('last_message_at', '<', cutoffTime)
          .select('id', 'name', 'phone', 'assigned_to', 'instance_id');

        for (const lead of pendingLeads) {
          // Check if last message was from lead
          const lastMessage = await db('messages')
            .where('lead_id', lead.id)
            .orderBy('created_at', 'desc')
            .first();

          if (lastMessage && lastMessage.sender_type === 'lead') {
            // Get assigned attendant
            const attendant = await db('users')
              .where('id', lead.assigned_to)
              .first();

            if (attendant && lead.assigned_to) {
              alertsCreated += await this.createAlert(
                lead.id,
                lead.assigned_to,
                'pending_response',
                `Lead ${lead.name} is waiting for a response`,
                'high'
              );
            }
          }
        }
      }

      return alertsCreated;
    } catch (error) {
      throw new Error(`Failed to check pending follow-ups: ${error.message}`);
    }
  }

  /**
   * Create a follow-up alert
   * @param {string} leadId - Lead ID
   * @param {string} userId - User ID to alert
   * @param {string} type - Alert type (pending_response, followup_due, etc)
   * @param {string} message - Alert message
   * @param {string} priority - Alert priority (low, medium, high, critical)
   * @returns {Promise<number>} Alert ID
   */
  async createAlert(leadId, userId, type, message, priority = 'medium') {
    try {
      const [alertId] = await db('alerts').insert({
        lead_id: leadId,
        user_id: userId,
        type: type,
        message: message,
        priority: priority,
        read: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Get user config to check if WhatsApp notification is enabled
      const userConfig = await db('user_configs')
        .where('user_id', userId)
        .where('key', 'alert_whatsapp_notifications')
        .first();

      if (userConfig && userConfig.value === 'true') {
        // Get user's WhatsApp phone (personal or assigned instance)
        const user = await db('users')
          .where('id', userId)
          .first();

        if (user && user.whatsapp_phone) {
          const instance = await db('whatsapp_instances')
            .where('company_id', user.company_id)
            .where('active', true)
            .first();

          if (instance) {
            try {
              await evolutionService.sendMessage(
                instance.instance_id,
                user.whatsapp_phone,
                `Alert: ${message}`
              );
            } catch (error) {
              console.error('Failed to send WhatsApp notification:', error.message);
            }
          }
        }
      }

      return alertId;
    } catch (error) {
      throw new Error(`Failed to create alert: ${error.message}`);
    }
  }

  /**
   * Get alert timeline for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results (default: 50)
   * @param {number} options.offset - Pagination offset (default: 0)
   * @param {boolean} options.unreadOnly - Only unread alerts (default: false)
   * @returns {Promise<Array>} Array of alerts
   */
  async getAlertTimeline(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, unreadOnly = false } = options;

      let query = db('alerts')
        .where('user_id', userId)
        .orderBy('created_at', 'desc');

      if (unreadOnly) {
        query = query.where('read', false);
      }

      const alerts = await query
        .limit(limit)
        .offset(offset)
        .select('*');

      // Enrich with lead information
      const enrichedAlerts = await Promise.all(
        alerts.map(async (alert) => {
          const lead = await db('leads')
            .where('id', alert.lead_id)
            .select('id', 'name', 'phone', 'email', 'company', 'status')
            .first();

          return {
            ...alert,
            lead: lead || null
          };
        })
      );

      return enrichedAlerts;
    } catch (error) {
      throw new Error(`Failed to get alert timeline: ${error.message}`);
    }
  }

  /**
   * Mark alert as read
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Updated alert
   */
  async markAlertRead(alertId) {
    try {
      await db('alerts')
        .where('id', alertId)
        .update({
          read: true,
          updated_at: new Date()
        });

      return db('alerts')
        .where('id', alertId)
        .first();
    } catch (error) {
      throw new Error(`Failed to mark alert as read: ${error.message}`);
    }
  }

  /**
   * Mark multiple alerts as read
   * @param {Array} alertIds - Array of alert IDs
   * @returns {Promise<number>} Number of updated alerts
   */
  async markAlertsRead(alertIds) {
    try {
      return await db('alerts')
        .whereIn('id', alertIds)
        .update({
          read: true,
          updated_at: new Date()
        });
    } catch (error) {
      throw new Error(`Failed to mark alerts as read: ${error.message}`);
    }
  }

  /**
   * Get unread alert count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of unread alerts
   */
  async getUnreadCount(userId) {
    try {
      const result = await db('alerts')
        .where('user_id', userId)
        .where('read', false)
        .count('* as count')
        .first();

      return result.count || 0;
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  /**
   * Delete an alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAlert(alertId) {
    try {
      await db('alerts')
        .where('id', alertId)
        .delete();

      return true;
    } catch (error) {
      throw new Error(`Failed to delete alert: ${error.message}`);
    }
  }

  /**
   * Batch delete alerts
   * @param {Array} alertIds - Array of alert IDs
   * @returns {Promise<number>} Number of deleted alerts
   */
  async deleteAlerts(alertIds) {
    try {
      return await db('alerts')
        .whereIn('id', alertIds)
        .delete();
    } catch (error) {
      throw new Error(`Failed to delete alerts: ${error.message}`);
    }
  }

  /**
   * Get alerts by priority
   * @param {string} userId - User ID
   * @param {string} priority - Priority level
   * @returns {Promise<Array>} Alerts matching priority
   */
  async getAlertsByPriority(userId, priority) {
    try {
      return await db('alerts')
        .where('user_id', userId)
        .where('priority', priority)
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Failed to get alerts by priority: ${error.message}`);
    }
  }

  /**
   * Get alerts by type
   * @param {string} userId - User ID
   * @param {string} type - Alert type
   * @returns {Promise<Array>} Alerts matching type
   */
  async getAlertsByType(userId, type) {
    try {
      return await db('alerts')
        .where('user_id', userId)
        .where('type', type)
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Failed to get alerts by type: ${error.message}`);
    }
  }
}

// Create singleton instance
const followupService = new FollowupService();

// Auto-start if enabled in environment
if (process.env.FOLLOWUP_SERVICE_ENABLED === 'true') {
  followupService.start(process.env.FOLLOWUP_CHECK_SCHEDULE || '*/5 * * * *');
}

module.exports = followupService;
