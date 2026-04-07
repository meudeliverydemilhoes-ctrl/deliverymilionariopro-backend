const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/v1/messages/:conversationId
 * Get message history for a conversation
 */
router.get('/:conversationId', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    // Controller logic:
    // 1. Fetch conversation by ID
    // 2. Check user has access to conversation
    // 3. Fetch messages with pagination (newest first or oldest first based on UI)
    // 4. Include sender info and message status
    // 5. Mark all messages as read for current user

    const messages = [
      {
        id: 'msg_001',
        conversationId: req.params.conversationId,
        senderId: 'lead_001',
        senderName: 'Carlos Silva',
        senderAvatar: 'https://ui-avatars.com/api/?name=Carlos+Silva',
        senderType: 'contact', // 'contact' or 'agent'
        content: 'Hi, I\'m interested in your WhatsApp CRM solution.',
        mediaUrl: null,
        mediaType: null,
        status: 'delivered', // 'sent', 'delivered', 'read'
        timestamp: '2024-03-05T10:15:00Z',
        edited: false,
        editedAt: null
      },
      {
        id: 'msg_002',
        conversationId: req.params.conversationId,
        senderId: 'user_123',
        senderName: 'João Santos',
        senderAvatar: 'https://ui-avatars.com/api/?name=Joao+Santos',
        senderType: 'agent',
        content: 'Hello Carlos! Thank you for reaching out. I\'d be happy to help you learn more about our platform.',
        mediaUrl: null,
        mediaType: null,
        status: 'read',
        timestamp: '2024-03-05T10:30:00Z',
        edited: false,
        editedAt: null
      },
      {
        id: 'msg_003',
        conversationId: req.params.conversationId,
        senderId: 'lead_001',
        senderName: 'Carlos Silva',
        senderAvatar: 'https://ui-avatars.com/api/?name=Carlos+Silva',
        senderType: 'contact',
        content: 'Can I schedule a demo?',
        mediaUrl: null,
        mediaType: null,
        status: 'delivered',
        timestamp: '2024-03-05T16:45:00Z',
        edited: false,
        editedAt: null
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 15,
        totalPages: Math.ceil(15 / parseInt(limit))
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
 * POST /api/v1/messages/send
 * Send a message in a conversation
 */
router.post('/send', verifyToken, (req, res) => {
  try {
    const { conversationId, content, mediaUrl, mediaType, templateId } = req.body;

    // Controller logic:
    // 1. Validate required fields (conversationId, content or media)
    // 2. Check user is assigned to conversation or is supervisor
    // 3. If using template, fetch template content and merge variables
    // 4. Send message via Evolution API to WhatsApp
    // 5. Create message record in database
    // 6. Emit socket.io event to conversation participants
    // 7. Update conversation lastMessage and timestamp
    // 8. Return message with delivery status

    const newMessage = {
      id: 'msg_' + Date.now(),
      conversationId: conversationId,
      senderId: req.user.id,
      senderName: 'João Santos',
      senderAvatar: 'https://ui-avatars.com/api/?name=Joao+Santos',
      senderType: 'agent',
      content: content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      status: 'sent',
      timestamp: new Date().toISOString(),
      edited: false,
      editedAt: null,
      whatsappMessageId: 'wamid_' + Date.now() // Evolution API message ID
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Message sent successfully',
      data: newMessage
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
 * PATCH /api/v1/messages/:id
 * Edit a message (only allowed within 15 minutes)
 */
router.patch('/:id', verifyToken, (req, res) => {
  try {
    const { content } = req.body;

    // Controller logic:
    // 1. Check message belongs to current user
    // 2. Check message is not older than 15 minutes
    // 3. Update message content in database
    // 4. Update via Evolution API
    // 5. Return updated message

    const updatedMessage = {
      id: req.params.id,
      content: content,
      edited: true,
      editedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Message updated successfully',
      data: updatedMessage
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
 * DELETE /api/v1/messages/:id
 * Delete a message
 */
router.delete('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Check message belongs to current user or user is supervisor
    // 2. Delete message via Evolution API
    // 3. Mark message as deleted in database
    // 4. Emit socket.io event

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Message deleted successfully',
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

module.exports = router;
