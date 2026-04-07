const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/v1/alerts
 * Get list of alerts for current user
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, read } = req.query;

    // Controller logic:
    // 1. Fetch alerts for current user
    // 2. Apply filters (status, type, read)
    // 3. Paginate results
    // 4. Order by creation date (newest first)
    // 5. Return alerts with metadata

    const alerts = [
      {
        id: 'alert_001',
        type: 'new_message',
        title: 'New message from Carlos Silva',
        description: 'Carlos Silva sent you a new message',
        severity: 'info', // info, warning, error, critical
        status: 'unread',
        action: {
          type: 'navigate',
          target: '/conversations/conv_001'
        },
        metadata: {
          conversationId: 'conv_001',
          contactName: 'Carlos Silva',
          messagePreview: 'When can I schedule a demo?'
        },
        createdAt: '2024-03-05T16:45:00Z',
        readAt: null,
        expiresAt: '2024-03-12T16:45:00Z'
      },
      {
        id: 'alert_002',
        type: 'follow_up_reminder',
        title: 'Follow-up reminder: Send proposal to Ana Costa',
        description: 'You have a follow-up task due soon',
        severity: 'warning',
        status: 'unread',
        action: {
          type: 'navigate',
          target: '/followup/followup_002'
        },
        metadata: {
          leadId: 'lead_002',
          leadName: 'Ana Costa',
          dueAt: '2024-03-10T09:00:00Z'
        },
        createdAt: '2024-03-05T14:00:00Z',
        readAt: null,
        expiresAt: '2024-03-15T14:00:00Z'
      },
      {
        id: 'alert_003',
        type: 'campaign_started',
        title: 'Campaign "Spring Promotion" started',
        description: 'Your campaign is now active and sending messages',
        severity: 'info',
        status: 'read',
        action: {
          type: 'navigate',
          target: '/campaigns/camp_001'
        },
        metadata: {
          campaignId: 'camp_001',
          campaignName: 'Spring Promotion 2024'
        },
        createdAt: '2024-03-01T08:00:00Z',
        readAt: '2024-03-01T08:15:00Z',
        expiresAt: '2024-04-01T08:00:00Z'
      },
      {
        id: 'alert_004',
        type: 'high_priority_lead',
        title: 'High priority lead assigned to you',
        description: 'João Santos assigned a high priority lead',
        severity: 'critical',
        status: 'unread',
        action: {
          type: 'navigate',
          target: '/leads/lead_003'
        },
        metadata: {
          leadId: 'lead_003',
          leadName: 'Tech Corp',
          assignedBy: 'João Santos'
        },
        createdAt: '2024-03-05T15:30:00Z',
        readAt: null,
        expiresAt: '2024-03-12T15:30:00Z'
      },
      {
        id: 'alert_005',
        type: 'system_notification',
        title: 'Scheduled maintenance tonight at 10 PM',
        description: 'Platform will be under maintenance for 30 minutes',
        severity: 'warning',
        status: 'read',
        action: {
          type: 'external',
          target: 'https://status.deliverymilionario.com'
        },
        metadata: {
          maintenanceStart: '2024-03-05T22:00:00Z',
          duration: 30
        },
        createdAt: '2024-03-05T10:00:00Z',
        readAt: '2024-03-05T10:30:00Z',
        expiresAt: '2024-03-05T23:00:00Z'
      }
    ];

    // Count unread
    const unreadCount = alerts.filter(a => a.status === 'unread').length;

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 12,
        totalPages: Math.ceil(12 / parseInt(limit))
      },
      metadata: {
        unreadCount: unreadCount,
        totalCount: 12
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

/**
 * GET /api/v1/alerts/unread
 * Get count of unread alerts
 */
router.get('/unread', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Count unread alerts for current user
    // 2. Return count

    const unreadCount = 3;

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        unreadCount: unreadCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

/**
 * PATCH /api/v1/alerts/:id/read
 * Mark alert as read
 */
router.patch('/:id/read', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Check alert exists and belongs to user
    // 2. Mark as read
    // 3. Update readAt timestamp
    // 4. Return updated alert

    const updatedAlert = {
      id: req.params.id,
      status: 'read',
      readAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Alert marked as read',
      data: updatedAlert
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message
    });
  }
});

/**
 * PATCH /api/v1/alerts/read-all
 * Mark all alerts as read
 */
router.patch('/read-all', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Mark all unread alerts as read for current user
    // 2. Update readAt timestamps
    // 3. Return count of updated alerts

    const result = {
      updatedCount: 5,
      readAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'All alerts marked as read',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

/**
 * DELETE /api/v1/alerts/:id
 * Delete/dismiss an alert
 */
router.delete('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Check alert exists and belongs to user
    // 2. Delete alert from database
    // 3. Return success

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Alert deleted successfully',
      data: { id: req.params.id, deleted: true }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

/**
 * DELETE /api/v1/alerts/delete-all
 * Delete all alerts for current user
 */
router.delete('/delete-all', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Delete all alerts for current user
    // 2. Return count of deleted alerts

    const result = {
      deletedCount: 12,
      deletedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'All alerts deleted successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

module.exports = router;
