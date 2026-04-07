const Bull = require('bull');
const fs = require('fs');
const csv = require('csv-parser');
const db = require('../config/database');
const evolutionService = require('./evolution.service');

/**
 * Campaign Service
 * Handles mass message dispatch campaigns with rate limiting
 */
class CampaignService {
  /**
   * Initialize Campaign Service with Bull queue
   * @param {Object} redisConfig - Redis configuration
   */
  constructor(redisConfig = {}) {
    this.queue = new Bull('campaigns', {
      redis: redisConfig.redis || {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379
      }
    });

    // Message queue for rate limiting (max 1 msg per second)
    this.messageQueue = new Bull('messages', {
      redis: redisConfig.redis || {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379
      }
    });

    this.setupQueueHandlers();
  }

  /**
   * Setup queue event handlers
   * @private
   */
  setupQueueHandlers() {
    this.queue.process(async (job) => {
      const { campaignId, contacts, message, instanceId } = job.data;

      try {
        await this.processBatch(contacts, message, instanceId);

        await db('campaigns')
          .where('id', campaignId)
          .update({
            status: 'completed',
            ended_at: new Date(),
            updated_at: new Date()
          });

        return { success: true };
      } catch (error) {
        throw new Error(`Campaign processing failed: ${error.message}`);
      }
    });

    // Message queue processor with 1 second delay between messages
    this.messageQueue.process(1, async (job) => {
      const { instanceId, phone, message } = job.data;

      try {
        await evolutionService.sendMessage(instanceId, phone, message);
        return { success: true };
      } catch (error) {
        throw new Error(`Message send failed: ${error.message}`);
      }
    });

    this.messageQueue.add(
      { instanceId: '', phone: '', message: '' },
      { delay: 1000, repeat: { every: 1000 } }
    ).catch(() => {});
  }

  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign data
   * @param {string} campaignData.company_id - Company ID
   * @param {string} campaignData.name - Campaign name
   * @param {string} campaignData.message - Message template
   * @param {string} campaignData.instance_id - WhatsApp instance ID
   * @param {number} campaignData.user_id - User ID creating campaign
   * @returns {Promise<Object>} Created campaign
   */
  async createCampaign(campaignData) {
    try {
      const [campaignId] = await db('campaigns').insert({
        company_id: campaignData.company_id,
        name: campaignData.name,
        message: campaignData.message,
        instance_id: campaignData.instance_id,
        user_id: campaignData.user_id,
        status: 'draft',
        total_contacts: campaignData.total_contacts || 0,
        sent_count: 0,
        failed_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      return db('campaigns')
        .where('id', campaignId)
        .first();
    } catch (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  /**
   * Start a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Job details
   */
  async startCampaign(campaignId) {
    try {
      const campaign = await db('campaigns')
        .where('id', campaignId)
        .first();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get contacts for campaign
      const contacts = await db('campaign_contacts')
        .where('campaign_id', campaignId)
        .select('phone', 'name', 'email');

      // Add to processing queue
      const job = await this.queue.add(
        {
          campaignId: campaignId,
          contacts: contacts,
          message: campaign.message,
          instanceId: campaign.instance_id
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );

      // Update campaign status
      await db('campaigns')
        .where('id', campaignId)
        .update({
          status: 'running',
          started_at: new Date(),
          updated_at: new Date()
        });

      return {
        campaignId: campaignId,
        jobId: job.id,
        status: 'queued'
      };
    } catch (error) {
      throw new Error(`Failed to start campaign: ${error.message}`);
    }
  }

  /**
   * Process a batch of contacts with rate limiting
   * @param {Array} contacts - Array of contact objects {phone, name, email}
   * @param {string} message - Message template
   * @param {string} instanceId - WhatsApp instance ID
   * @returns {Promise<Object>} Processing stats
   */
  async processBatch(contacts, message, instanceId) {
    try {
      let sent = 0;
      let failed = 0;

      for (const contact of contacts) {
        try {
          // Replace template variables
          const personalizedMessage = message
            .replace(/\{name\}/g, contact.name || 'there')
            .replace(/\{email\}/g, contact.email || '')
            .replace(/\{phone\}/g, contact.phone || '');

          // Add message to rate-limited queue
          await this.messageQueue.add(
            {
              instanceId: instanceId,
              phone: contact.phone,
              message: personalizedMessage
            },
            { delay: sent * 1000 } // Stagger messages by 1 second each
          );

          sent++;
        } catch (error) {
          failed++;
          console.error(`Failed to queue message for ${contact.phone}: ${error.message}`);
        }
      }

      return {
        total: contacts.length,
        sent: sent,
        failed: failed
      };
    } catch (error) {
      throw new Error(`Failed to process batch: ${error.message}`);
    }
  }

  /**
   * Parse CSV file and return contacts
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Array>} Array of contact objects
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const contacts = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (row.phone) {
            contacts.push({
              phone: row.phone.toString(),
              name: row.name || '',
              email: row.email || ''
            });
          }
        })
        .on('end', () => {
          resolve(contacts);
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  /**
   * Upload contacts from CSV to campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<number>} Number of contacts uploaded
   */
  async uploadContacts(campaignId, filePath) {
    try {
      const contacts = await this.parseCSV(filePath);

      const contactRecords = contacts.map(contact => ({
        campaign_id: campaignId,
        phone: contact.phone,
        name: contact.name,
        email: contact.email,
        created_at: new Date()
      }));

      await db('campaign_contacts').insert(contactRecords);

      // Update campaign total_contacts count
      await db('campaigns')
        .where('id', campaignId)
        .update({
          total_contacts: contacts.length,
          updated_at: new Date()
        });

      return contacts.length;
    } catch (error) {
      throw new Error(`Failed to upload contacts: ${error.message}`);
    }
  }

  /**
   * Update campaign statistics
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Updated stats
   */
  async updateCampaignStats(campaignId) {
    try {
      const campaign = await db('campaigns')
        .where('id', campaignId)
        .first();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Count sent and failed messages from logs
      const stats = await db('message_logs')
        .where('campaign_id', campaignId)
        .select('status')
        .count('* as count')
        .groupBy('status');

      let sentCount = 0;
      let failedCount = 0;

      stats.forEach(stat => {
        if (stat.status === 'sent') {
          sentCount = stat.count;
        } else if (stat.status === 'failed') {
          failedCount = stat.count;
        }
      });

      await db('campaigns')
        .where('id', campaignId)
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date()
        });

      return {
        campaignId: campaignId,
        totalContacts: campaign.total_contacts,
        sentCount: sentCount,
        failedCount: failedCount,
        pendingCount: campaign.total_contacts - sentCount - failedCount
      };
    } catch (error) {
      throw new Error(`Failed to update campaign stats: ${error.message}`);
    }
  }

  /**
   * Get campaign details
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Campaign details
   */
  async getCampaign(campaignId) {
    try {
      const campaign = await db('campaigns')
        .where('id', campaignId)
        .first();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      return campaign;
    } catch (error) {
      throw new Error(`Failed to get campaign: ${error.message}`);
    }
  }

  /**
   * Cancel a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelCampaign(campaignId) {
    try {
      await db('campaigns')
        .where('id', campaignId)
        .update({
          status: 'cancelled',
          updated_at: new Date()
        });

      return { success: true, campaignId: campaignId };
    } catch (error) {
      throw new Error(`Failed to cancel campaign: ${error.message}`);
    }
  }
}

// Create singleton instance
const campaignService = new CampaignService();

module.exports = campaignService;
