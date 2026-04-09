const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * GET /api/v1/conversations
 * Listar conversas reais do banco de dados
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('conversations as c')
      .join('leads as l', 'c.lead_id', 'l.id')
      .select(
        'c.id',
        'c.lead_id as contactId',
        'l.name as contactName',
        'l.phone as contactPhone',
        'l.avatar_url as contactAvatar',
        'c.status',
        'l.priority',
        'c.assigned_to as assignedTo',
        'c.last_message as lastMessage',
        'c.last_message_at as lastMessageTime',
        'c.unread_count as unreadCount',
        'l.source',
        'c.created_at as createdAt',
        'c.updated_at as updatedAt'
      )
      .orderBy('c.last_message_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    if (search) {
      query = query.where(function () {
        this.where('l.name', 'ilike', `%${search}%`)
          .orWhere('l.phone', 'ilike', `%${search}%`)
          .orWhere('c.last_message', 'ilike', `%${search}%`);
      });
    }

    if (status) {
      query = query.where('c.status', status);
    }

    const conversations = await query;

    // Contar total
    let countQuery = db('conversations as c')
      .join('leads as l', 'c.lead_id', 'l.id')
      .count('c.id as total');
    if (search) {
      countQuery = countQuery.where(function () {
        this.where('l.name', 'ilike', `%${search}%`)
          .orWhere('l.phone', 'ilike', `%${search}%`);
      });
    }
    if (status) {
      countQuery = countQuery.where('c.status', status);
    }
    const [{ total }] = await countQuery;

    // Formatar avatar
    const data = conversations.map(conv => ({
      ...conv,
      contactAvatar: conv.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contactName || 'Lead')}&background=6C63FF&color=fff`
    }));

    res.json({
      success: true,
      statusCode: 200,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: Math.ceil(parseInt(total) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Conversations] Erro ao listar:', error.message);
    res.status(500).json({ success: false, statusCode: 500, message: error.message });
  }
});

/**
 * GET /api/v1/conversations/:id
 * Detalhes de uma conversa
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const conversation = await db('conversations as c')
      .join('leads as l', 'c.lead_id', 'l.id')
      .select(
        'c.id',
        'c.lead_id as contactId',
        'l.name as contactName',
        'l.phone as contactPhone',
        'l.email as contactEmail',
        'l.avatar_url as contactAvatar',
        'c.status',
        'l.priority',
        'c.assigned_to as assignedTo',
        'l.source',
        'c.last_message as lastMessage',
        'c.last_message_at as lastMessageTime',
        'c.unread_count as unreadCount',
        'c.created_at as createdAt',
        'c.updated_at as updatedAt'
      )
      .where('c.id', req.params.id)
      .first();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
    }

    // Zerar unread
    await db('conversations').where('id', req.params.id).update({ unread_count: 0 });

    res.json({
      success: true,
      statusCode: 200,
      data: {
        ...conversation,
        contactAvatar: conversation.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.contactName || 'Lead')}&background=6C63FF&color=fff`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, statusCode: 500, message: error.message });
  }
});

/**
 * PATCH /api/v1/conversations/:id/assign
 */
router.patch('/:id/assign', verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    await db('conversations')
      .where('id', req.params.id)
      .update({ assigned_to: userId, updated_at: new Date() });

    res.json({ success: true, message: 'Conversa atribuída com sucesso' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/v1/conversations/:id/status
 */
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db('conversations')
      .where('id', req.params.id)
      .update({ status, updated_at: new Date() });

    res.json({ success: true, message: `Status atualizado para ${status}` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
