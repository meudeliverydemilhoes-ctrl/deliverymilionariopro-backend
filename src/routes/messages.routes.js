const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');
const evolutionService = require('../services/evolution.service');

/**
 * GET /api/v1/messages/:conversationId
 * Histórico de mensagens reais do banco
 */
router.get('/:conversationId', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Buscar conversa para verificar se existe
    const conversation = await db('conversations')
      .where('id', req.params.conversationId)
      .first();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
    }

    // Buscar mensagens
    const messages = await db('messages')
      .where('conversation_id', req.params.conversationId)
      .orderBy('created_at', 'asc')
      .limit(parseInt(limit))
      .offset(offset);

    // Buscar lead info para nome
    const lead = await db('leads').where('id', conversation.lead_id).first();

    // Formatar mensagens para o frontend
    const data = messages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.from_id,
      senderName: msg.from_type === 'lead' ? (lead?.name || 'Cliente') : 'Atendente',
      senderType: msg.from_type === 'lead' ? 'contact' : 'agent',
      content: msg.content,
      mediaUrl: msg.media_url || null,
      mediaType: msg.media_type || 'text',
      status: msg.status || 'sent',
      timestamp: msg.created_at,
      whatsappMessageId: msg.whatsapp_message_id
    }));

    // Contar total
    const [{ total }] = await db('messages')
      .where('conversation_id', req.params.conversationId)
      .count('id as total');

    // Zerar unread ao ler mensagens
    await db('conversations')
      .where('id', req.params.conversationId)
      .update({ unread_count: 0 });

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
    console.error('[Messages] Erro ao listar:', error.message);
    res.status(500).json({ success: false, statusCode: 500, message: error.message });
  }
});

/**
 * POST /api/v1/messages/send
 * Enviar mensagem real via WhatsApp (WAHA)
 */
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { conversationId, content, mediaUrl, mediaType } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ success: false, message: 'conversationId e content são obrigatórios' });
    }

    // Buscar conversa e lead
    const conversation = await db('conversations')
      .where('id', conversationId)
      .first();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
    }

    const lead = await db('leads').where('id', conversation.lead_id).first();
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead não encontrado' });
    }

    // Enviar via WhatsApp (WAHA)
    let waResult;
    if (mediaUrl) {
      waResult = await evolutionService.sendMedia(lead.phone, mediaUrl, content, mediaType);
    } else {
      waResult = await evolutionService.sendText(lead.phone, content);
    }

    // Salvar mensagem no banco
    const [newMessage] = await db('messages').insert({
      conversation_id: conversationId,
      from_type: 'attendant',
      from_id: req.user.id,
      content: content,
      media_type: mediaType || 'text',
      media_url: mediaUrl || null,
      status: 'sent',
      whatsapp_message_id: waResult?.key?.id || null,
      created_at: new Date()
    }).returning('*');

    // Atualizar conversa
    await db('conversations')
      .where('id', conversationId)
      .update({
        last_message: content,
        last_message_at: new Date(),
        updated_at: new Date()
      });

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Mensagem enviada com sucesso',
      data: {
        id: newMessage.id,
        conversationId: newMessage.conversation_id,
        senderId: req.user.id,
        senderName: req.user.name || 'Atendente',
        senderType: 'agent',
        content: newMessage.content,
        mediaUrl: newMessage.media_url,
        mediaType: newMessage.media_type,
        status: 'sent',
        timestamp: newMessage.created_at,
        whatsappMessageId: newMessage.whatsapp_message_id
      }
    });
  } catch (error) {
    console.error('[Messages] Erro ao enviar:', error.message);
    res.status(500).json({ success: false, statusCode: 500, message: error.message });
  }
});

/**
 * DELETE /api/v1/messages/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await db('messages').where('id', req.params.id).del();
    res.json({ success: true, message: 'Mensagem deletada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
