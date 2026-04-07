const db = require('../config/database');

/**
 * Metrics Service
 * Provides analytics and reporting for the CRM system
 */
class MetricsService {
  /**
   * Get dashboard statistics
   * @param {string} companyId - Company ID
   * @param {Object} dateRange - Date range filter
   * @param {Date} dateRange.startDate - Start date
   * @param {Date} dateRange.endDate - End date
   * @returns {Promise<Object>} Dashboard stats
   */
  async getDashboardStats(companyId, dateRange = {}) {
    try {
      const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;

      // Total leads
      const leadsCount = await db('leads')
        .where('company_id', companyId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first();

      // Leads by status
      const leadsByStatus = await db('leads')
        .where('company_id', companyId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .select('status')
        .count('* as count')
        .groupBy('status');

      // Total messages
      const messagesCount = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .where('messages.created_at', '>=', startDate)
        .where('messages.created_at', '<=', endDate)
        .count('* as count')
        .first();

      // Messages by type
      const messagesByType = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .where('messages.created_at', '>=', startDate)
        .where('messages.created_at', '<=', endDate)
        .select('sender_type')
        .count('* as count')
        .groupBy('sender_type');

      // Active users
      const activeUsers = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .where('messages.created_at', '>=', startDate)
        .where('messages.created_at', '<=', endDate)
        .distinct('leads.assigned_to')
        .count('* as count')
        .first();

      return {
        periodLabel: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        totalLeads: leadsCount.count || 0,
        totalMessages: messagesCount.count || 0,
        activeUsers: activeUsers.count || 0,
        leadsByStatus: leadsByStatus.map(s => ({ status: s.status, count: s.count })),
        messagesByType: messagesByType.map(m => ({ type: m.sender_type, count: m.count }))
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error.message}`);
    }
  }

  /**
   * Get message statistics
   * @param {string} companyId - Company ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Message stats
   */
  async getMessageStats(companyId, startDate, endDate) {
    try {
      // Total messages
      const totalMessages = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .whereBetween('messages.created_at', [startDate, endDate])
        .count('* as count')
        .first();

      // Incoming vs outgoing
      const directionStats = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .whereBetween('messages.created_at', [startDate, endDate])
        .select('sender_type')
        .count('* as count')
        .groupBy('sender_type');

      // Average response time (minutes)
      const responseTimeData = await db.raw(`
        SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) / 60) as avg_response_time
        FROM messages m1
        JOIN messages m2 ON m1.lead_id = m2.lead_id AND m2.created_at > m1.created_at
        JOIN leads l ON l.id = m1.lead_id
        WHERE l.company_id = ?
        AND m1.sender_type = 'lead'
        AND m2.sender_type != 'lead'
        AND m2.created_at = (
          SELECT MIN(created_at) FROM messages m3
          WHERE m3.lead_id = m1.lead_id
          AND m3.created_at > m1.created_at
          AND m3.sender_type != 'lead'
        )
        AND m1.created_at >= ? AND m1.created_at <= ?
      `, [companyId, startDate, endDate]);

      // Messages per lead
      const messagesPerLead = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .whereBetween('messages.created_at', [startDate, endDate])
        .select('lead_id')
        .count('* as count')
        .groupBy('lead_id');

      const avgMessagesPerLead = messagesPerLead.length > 0
        ? messagesPerLead.reduce((sum, m) => sum + m.count, 0) / messagesPerLead.length
        : 0;

      return {
        totalMessages: totalMessages.count || 0,
        incomingMessages: directionStats.find(d => d.sender_type === 'lead')?.count || 0,
        outgoingMessages: directionStats.find(d => d.sender_type !== 'lead')?.count || 0,
        avgResponseTimeMinutes: Math.round(responseTimeData.rows[0]?.avg_response_time || 0),
        avgMessagesPerLead: Math.round(avgMessagesPerLead * 100) / 100
      };
    } catch (error) {
      throw new Error(`Failed to get message stats: ${error.message}`);
    }
  }

  /**
   * Get sales funnel statistics
   * @param {string} companyId - Company ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Funnel stats
   */
  async getFunnelStats(companyId, startDate, endDate) {
    try {
      const statusProgression = await db('leads')
        .where('company_id', companyId)
        .whereBetween('created_at', [startDate, endDate])
        .select('status')
        .count('* as count')
        .groupBy('status');

      // Calculate funnel metrics
      const total = statusProgression.reduce((sum, s) => sum + s.count, 0);

      const funnelData = {
        total: total,
        byStatus: {}
      };

      statusProgression.forEach(status => {
        const percentage = total > 0 ? Math.round((status.count / total) * 100) : 0;
        funnelData.byStatus[status.status] = {
          count: status.count,
          percentage: percentage
        };
      });

      // Calculate conversion rates between stages
      const newLeads = funnelData.byStatus['new']?.count || 0;
      const qualifiedLeads = funnelData.byStatus['qualified']?.count || 0;
      const proposedLeads = funnelData.byStatus['proposed']?.count || 0;
      const closedLeads = funnelData.byStatus['closed']?.count || 0;

      funnelData.conversions = {
        newToQualified: newLeads > 0 ? Math.round((qualifiedLeads / newLeads) * 100) : 0,
        qualifiedToProposed: qualifiedLeads > 0 ? Math.round((proposedLeads / qualifiedLeads) * 100) : 0,
        proposedToClosed: proposedLeads > 0 ? Math.round((closedLeads / proposedLeads) * 100) : 0,
        newToClosed: newLeads > 0 ? Math.round((closedLeads / newLeads) * 100) : 0
      };

      return funnelData;
    } catch (error) {
      throw new Error(`Failed to get funnel stats: ${error.message}`);
    }
  }

  /**
   * Get seller/attendant scorecard
   * @param {string} userId - User ID
   * @param {string} period - Time period (today, week, month, year)
   * @returns {Promise<Object>} Scorecard data
   */
  async getSellerScorecard(userId, period = 'month') {
    try {
      const { startDate, endDate } = this.getPeriodDates(period);

      // Total leads assigned
      const assignedLeads = await db('leads')
        .where('assigned_to', userId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first();

      // Leads closed
      const closedLeads = await db('leads')
        .where('assigned_to', userId)
        .where('status', 'closed')
        .where('updated_at', '>=', startDate)
        .where('updated_at', '<=', endDate)
        .count('* as count')
        .first();

      // Total messages sent
      const messagesSent = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.assigned_to', userId)
        .where('messages.sender_type', '!=', 'lead')
        .where('messages.created_at', '>=', startDate)
        .where('messages.created_at', '<=', endDate)
        .count('* as count')
        .first();

      // Average response time
      const avgResponseTime = await db.raw(`
        SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) / 60) as avg_time
        FROM messages m1
        JOIN messages m2 ON m1.lead_id = m2.lead_id AND m2.created_at > m1.created_at
        JOIN leads l ON l.id = m1.lead_id
        WHERE l.assigned_to = ?
        AND m1.sender_type = 'lead'
        AND m2.sender_type != 'lead'
        AND m1.created_at >= ? AND m1.created_at <= ?
      `, [userId, startDate, endDate]);

      return {
        period: period,
        dateRange: { startDate, endDate },
        assignedLeads: assignedLeads.count || 0,
        closedLeads: closedLeads.count || 0,
        conversionRate: assignedLeads.count > 0
          ? Math.round((closedLeads.count / assignedLeads.count) * 100)
          : 0,
        messagesSent: messagesSent.count || 0,
        avgResponseTimeMinutes: Math.round(avgResponseTime.rows[0]?.avg_time || 0)
      };
    } catch (error) {
      throw new Error(`Failed to get seller scorecard: ${error.message}`);
    }
  }

  /**
   * Get chatbot performance metrics
   * @param {string} companyId - Company ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Bot performance data
   */
  async getBotPerformance(companyId, startDate, endDate) {
    try {
      // Total messages from bot
      const botMessages = await db('messages')
        .join('leads', 'leads.id', '=', 'messages.lead_id')
        .where('leads.company_id', companyId)
        .where('messages.sender_type', 'bot')
        .whereBetween('messages.created_at', [startDate, endDate])
        .count('* as count')
        .first();

      // Conversations handled by bot (no human intervention)
      const botOnlyConversations = await db.raw(`
        SELECT COUNT(DISTINCT l.id) as count
        FROM leads l
        WHERE l.company_id = ?
        AND l.created_at >= ?
        AND l.created_at <= ?
        AND NOT EXISTS (
          SELECT 1 FROM messages m
          WHERE m.lead_id = l.id
          AND m.sender_type NOT IN ('bot', 'lead')
        )
      `, [companyId, startDate, endDate]);

      // Conversations that escalated to human
      const escalatedConversations = await db.raw(`
        SELECT COUNT(DISTINCT l.id) as count
        FROM leads l
        WHERE l.company_id = ?
        AND l.created_at >= ?
        AND l.created_at <= ?
        AND EXISTS (
          SELECT 1 FROM messages m
          WHERE m.lead_id = l.id
          AND m.sender_type NOT IN ('bot', 'lead')
        )
      `, [companyId, startDate, endDate]);

      const totalBotInteractions = botMessages.count || 0;

      return {
        botMessages: totalBotInteractions,
        botOnlyConversations: botOnlyConversations.rows[0]?.count || 0,
        escalatedConversations: escalatedConversations.rows[0]?.count || 0,
        escalationRate: (botOnlyConversations.rows[0]?.count || 0) > 0
          ? Math.round((escalatedConversations.rows[0]?.count / (botOnlyConversations.rows[0]?.count + escalatedConversations.rows[0]?.count)) * 100)
          : 0
      };
    } catch (error) {
      throw new Error(`Failed to get bot performance: ${error.message}`);
    }
  }

  /**
   * Get conversion rate metrics
   * @param {string} companyId - Company ID
   * @param {string} period - Time period
   * @returns {Promise<Object>} Conversion data
   */
  async getConversionRate(companyId, period = 'month') {
    try {
      const { startDate, endDate } = this.getPeriodDates(period);

      // Total new leads
      const newLeads = await db('leads')
        .where('company_id', companyId)
        .where('status', 'new')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first();

      // Converted leads (closed deals)
      const convertedLeads = await db('leads')
        .where('company_id', companyId)
        .where('status', 'closed')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first();

      const conversionRate = newLeads.count > 0
        ? Math.round((convertedLeads.count / newLeads.count) * 100)
        : 0;

      return {
        period: period,
        totalNewLeads: newLeads.count || 0,
        convertedLeads: convertedLeads.count || 0,
        conversionRate: conversionRate,
        dateRange: { startDate, endDate }
      };
    } catch (error) {
      throw new Error(`Failed to get conversion rate: ${error.message}`);
    }
  }

  /**
   * Helper function to get date range for period
   * @param {string} period - Period type
   * @returns {Object} Start and end dates
   * @private
   */
  getPeriodDates(period) {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    return { startDate, endDate };
  }
}

// Create singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
