const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/v1/conversations
 * List all conversations with filters and search
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, assignedTo, priority } = req.query;

    // Controller logic:
    // 1. Build query with filters (status, assignedTo, priority)
    // 2. Apply search on contact name, phone, last message
    // 3. Paginate and order by lastMessage timestamp
    // 4. Return conversations with unread count and last message preview

    const conversations = [
      {
        id: 'conv_001',
        contactId: 'lead_001',
        contactName: 'Carlos Silva',
        contactPhone: '+55 11 98765-4321',
        contactAvatar: 'https://ui-avatars.com/api/?name=Carlos+Silva',
        status: 'open',
        priority: 'high',
        assignedTo: 'user_123',
        assignedToName: 'João Santos',
        lastMessage: 'When can I schedule a demo?',
        lastMessageTime: '2024-03-05T16:45:00Z',
        unreadCount: 2,
        messageCount: 15,
        source: 'whatsapp',
        tags: ['interested', 'urgent'],
        createdAt: '2024-03-01T08:00:00Z',
        updatedAt: '2024-03-05T16:45:00Z'
      },
      {
        id: 'conv_002',
        contactId: 'lead_002',
        contactName: 'Ana Costa',
        contactPhone: '+55 21 99876-5432',
        contactAvatar: 'https://ui-avatars.com/api/?name=Ana+Costa',
        status: 'on_hold',
        priority: 'medium',
        assignedTo: 'user_124',
        assignedToName: 'Maria Silva',
        lastMessage: 'Thanks for the information. I\'ll review and get back to you.',
        lastMessageTime: '2024-03-04T14:20:00Z',
        unreadCount: 0,
        messageCount: 8,
        source: 'whatsapp',
        tags: ['proposal_sent'],
        createdAt: '2024-02-28T10:15:00Z',
        updatedAt: '2024-03-04T14:20:00Z'
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 28,
        totalPages: Math.ceil(28 / parseInt(limit))
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
 * GET /api/v1/conversations/:id
 * Get conversation details with message history
 */
router.get('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch conversation by ID
    // 2. Mark as read for current user
    // 3. Fetch message history (last 50 messages)
    // 4. Return full conversation details

    const conversation = {
      id: req.params.id,
      contactId: 'lead_001',
      contactName: 'Carlos Silva',
      contactPhone: '+55 11 98765-4321',
      contactEmail: 'carlos@example.com',
      contactAvatar: 'https://ui-avatars.com/api/?name=Carlos+Silva',
      status: 'open',
      priority: 'high',
      assignedTo: 'user_123',
      assignedToName: 'João Santos',
      source: 'whatsapp',
      messageCount: 15,
      tags: ['interested', 'urgent'],
      createdAt: '2024-03-01T08:00:00Z',
      updatedAt: '2024-03-05T16:45:00Z',
      customFields: {
        company: 'Tech Solutions',
        budget: '5000 BRL',
        timeline: '30 days'
      }
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: conversation
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
 * PATCH /api/v1/conversations/:id/assign
 * Assign conversation to a user
 */
router.patch('/:id/assign', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { userId } = req.body;

    // Controller logic:
    // 1. Validate user exists
    // 2. Check if conversation is not already assigned to another user
    // 3. Update conversation assignedTo field
    // 4. Create activity log entry
    // 5. Notify assigned user via socket.io

    const updatedConversation = {
      id: req.params.id,
      assignedTo: userId,
      assignedToName: 'New Agent',
      previousAssignee: 'user_123',
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Conversation assigned successfully',
      data: updatedConversation
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
 * PATCH /api/v1/conversations/:id/status
 * Update conversation status (open, closed, on_hold, waiting)
 */
router.patch('/:id/status', verifyToken, (req, res) => {
  try {
    const { status, reason } = req.body;

    // Controller logic:
    // 1. Validate status value (open, closed, on_hold, waiting)
    // 2. Check if user is assigned to conversation or is supervisor
    // 3. Update status in database
    // 4. If closing, generate completion notes
    // 5. Return updated conversation

    const updatedConversation = {
      id: req.params.id,
      status: status || 'open',
      previousStatus: 'open',
      closedReason: reason,
      closedAt: status === 'closed' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Conversation status updated to ${status}`,
      data: updatedConversation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message
    });
  }
});

module.exports = router;
