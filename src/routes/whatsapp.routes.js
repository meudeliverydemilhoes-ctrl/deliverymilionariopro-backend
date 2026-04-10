const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const evolutionService = require('../services/evolution.service');
const chatbotService = require('../services/anthropic.service');
const db = require('../config/database');

// ============================================
// DEBUG: Store last 20 raw webhook payloads
// ============================================
const webhookDebugLog = [];
const MAX_DEBUG_ENTRIES = 20;

/**
 * GET /api/v1/whatsapp/debug-webhooks
 * Retorna os ultimos webhooks raw recebidos (SEM auth para facilitar debug)
 */
router.get('/debug-webhooks', (req, res) => {
  res.json({
    total: webhookDebugLog.length,
    webhooks: webhookDebugLog
  });
});

/**
 * POST /api/v1/whatsapp/connect
 * Conectar WhatsApp via QR Code (WAHA)
 */
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const qrData = await evolutionService.getQRCode();
    const existing = await db('whatsapp_instances')
      .where('instance_name', evolutionService.instanceName)
      .first();

    if (!existing) {
      await db('whatsapp_instances').insert({
        user_id: req.user.id,
        instance_name: evolutionService.instanceName,
        status: 'connecting',
        api_url: process.env.EVOLUTION_API_URL,
        created_at: new Date(),
        updated_at: new Date()
      });
    } else {
      await db('whatsapp_instances')
        .where('id', existing.id)
        .update({ status: 'connecting', updated_at: new Date() });
    }

    res.json({
      success: true,
      message: 'Escaneie o QR Code no seu WhatsApp',
      data: {
        instanceName: evolutionService.instanceName,
        qrCode: qrData.base64 || qrData.code || qrData,
        qrcode: qrData.base64 || qrData.code || qrData,
        pairingCode: qrData.pairingCode || null,
        status: 'waiting_scan'
      }
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('404') || error.message.includes('Falha')) {
      try {
        const createData = await evolutionService.createInstance();
        res.json({
          success: true,
          message: 'Sessão criada! Escaneie o QR Code',
          data: {
            instanceName: evolutionService.instanceName,
            qrCode: createData.qrcode?.base64 || createData,
            qrcode: createData.qrcode?.base64 || createData,
            status: 'waiting_scan'
          }
        });
      } catch (createError) {
        res.status(500).json({ success: false, message: createError.message });
      }
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

/**
 * GET /api/v1/whatsapp/qrcode
 */
router.get('/qrcode', verifyToken, async (req, res) => {
  try {
    const qrData = await evolutionService.getQRCode();
    res.json({
      success: true,
      data: {
        qrCode: qrData.base64 || qrData.code || qrData,
        pairingCode: qrData.pairingCode || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/whatsapp/status
 */
router.get('/status', verifyToken, async (req, res) => {
  try {
    const state = await evolutionService.getConnectionState();
    const info = await evolutionService.getInstanceInfo();
    const isConnected = state.instance?.state === 'open';

    await db('whatsapp_instances')
      .where('instance_name', evolutionService.instanceName)
      .update({
        status: isConnected ? 'connected' : 'disconnected',
        phone_number: info?.[0]?.instance?.owner || null,
        updated_at: new Date()
      });

    res.json({
      success: true,
      data: {
        connected: isConnected,
        state: state.instance?.state || 'unknown',
        instanceName: evolutionService.instanceName,
        phoneNumber: info?.[0]?.instance?.owner || null,
        profileName: info?.[0]?.instance?.profileName || null,
        profilePicture: info?.[0]?.instance?.profilePictureUrl || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: { connected: false, state: 'error', message: error.message }
    });
  }
});

/**
 * POST /api/v1/whatsapp/disconnect
 */
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    await evolutionService.logoutInstance();
    await db('whatsapp_instances')
      .where('instance_name', evolutionService.instanceName)
      .update({ status: 'disconnected', updated_at: new Date() });
    res.json({ success: true, message: 'WhatsApp desconectado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/restart
 */
router.post('/restart', verifyToken, async (req, res) => {
  try {
    await evolutionService.restartInstance();
    res.json({ success: true, message: 'Instância reiniciada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/whatsapp/groups
 */
router.get('/groups', verifyToken, async (req, res) => {
  try {
    const groups = await evolutionService.getGroups();
    for (const group of (groups || [])) {
      const existing = await db('whatsapp_groups').where('group_id', group.id).first();
      if (!existing) {
        await db('whatsapp_groups').insert({
          group_id: group.id,
          name: group.subject,
          members_count: group.size || 0,
          status: 'active',
          created_at: new Date()
        });
      } else {
        await db('whatsapp_groups').where('id', existing.id).update({
          name: group.subject,
          members_count: group.size || 0
        });
      }
    }
    res.json({
      success: true,
      data: (groups || []).map(g => ({
        id: g.id,
        name: g.subject,
        members: g.size || 0,
        creation: g.creation,
        description: g.desc || ''
      })),
      total: (groups || []).length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/send
 */
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'phone e message são obrigatórios' });
    }
    const result = await evolutionService.sendText(phone, message);
    res.json({ success: true, message: 'Mensagem enviada', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/send-media
 */
router.post('/send-media', verifyToken, async (req, res) => {
  try {
    const { phone, mediaUrl, caption, mediaType } = req.body;
    if (!phone || !mediaUrl) {
      return res.status(400).json({ success: false, message: 'phone e mediaUrl são obrigatórios' });
    }
    const result = await evolutionService.sendMedia(phone, mediaUrl, caption, mediaType);
    res.json({ success: true, message: 'Mídia enviada', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/check-number
 */
router.post('/check-number', verifyToken, async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await evolutionService.checkWhatsAppNumber(phone);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/setup-webhook
 */
router.post('/setup-webhook', verifyToken, async (req, res) => {
  try {
    const webhookUrl = req.body.url || process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, message: 'URL do webhook é obrigatória' });
    }
    const result = await evolutionService.setWebhook(webhookUrl);
    res.json({ success: true, message: 'Webhook configurado', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/webhook
 * Receber eventos do WAHA (webhook)
 * NÃO requer autenticação JWT
 */
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const event = body.event;
    const session = body.session || body.instance;

    // DEBUG: Save raw webhook payload
    webhookDebugLog.unshift({
      timestamp: new Date().toISOString(),
      event: event,
      raw: JSON.parse(JSON.stringify(body))
    });
    if (webhookDebugLog.length > MAX_DEBUG_ENTRIES) {
      webhookDebugLog.length = MAX_DEBUG_ENTRIES;
    }

    console.log(`[Webhook] Evento: ${event} | Sessão: ${session}`);
    console.log(`[Webhook] RAW BODY KEYS: ${Object.keys(body).join(', ')}`);
    if (body.payload) {
      console.log(`[Webhook] PAYLOAD KEYS: ${Object.keys(body.payload).join(', ')}`);
      console.log(`[Webhook] payload.from=${body.payload.from} payload.to=${body.payload.to} payload.fromMe=${body.payload.fromMe}`);
      console.log(`[Webhook] payload.chatId=${body.payload.chatId} payload.participant=${body.payload.participant}`);
      console.log(`[Webhook] payload.notifyName=${body.payload.notifyName} payload.pushName=${body.payload.pushName}`);
      console.log(`[Webhook] payload.body=${(body.payload.body || '').substring(0, 80)}`);
      if (body.payload._data) {
        console.log(`[Webhook] payload._data KEYS: ${Object.keys(body.payload._data).join(', ')}`);
      }
      if (body.payload.key) {
        console.log(`[Webhook] payload.key: ${JSON.stringify(body.payload.key)}`);
      }
    }

    switch (event) {
      case 'message':
      case 'message.any':
      case 'messages.upsert':
      case 'MESSAGES_UPSERT': {
        const result = await evolutionService.processIncomingMessage(body);

        if (result && !result.isGroup) {
          const botConfig = await db('chatbot_config')
            .where('is_active', true)
            .first();

          if (botConfig) {
            try {
              await chatbotService.processIncomingMessage(
                result.lead.id,
                result.content
              );
              console.log(`[Webhook] Bot respondeu para ${result.pushName}`);
            } catch (botError) {
              console.error('[Webhook] Erro no chatbot:', botError.message);
            }
          }

          const io = req.app.get('io');
          if (io) {
            io.emit('new_message', {
              lead: result.lead,
              conversation: result.conversation,
              message: result.message,
              content: result.content,
              pushName: result.pushName
            });
          }
        }
        break;
      }

      case 'message.ack':
      case 'messages.update':
      case 'MESSAGES_UPDATE': {
        const data = body.payload || body.data;
        if (data?.key?.id && data?.status) {
          const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'read' };
          await db('messages')
            .where('whatsapp_message_id', data.key.id)
            .update({ status: statusMap[data.status] || 'sent' });
        }
        break;
      }

      case 'session.status': {
        const payload = body.payload || body.data;
        const status = payload?.status;
        console.log(`[Webhook] Sessão status: ${status}`);
        await db('whatsapp_instances')
          .where('instance_name', session)
          .update({ status: status === 'WORKING' ? 'connected' : 'disconnected', updated_at: new Date() });

        const io = req.app.get('io');
        if (io) {
          io.emit('whatsapp_status', {
            instance: session,
            state: status === 'WORKING' ? 'open' : 'close'
          });
        }
        break;
      }

      case 'connection.update':
      case 'CONNECTION_UPDATE': {
        const data = body.payload || body.data;
        const state = data?.state || data?.connection;
        console.log(`[Webhook] Conexão: ${state}`);
        await db('whatsapp_instances')
          .where('instance_name', session)
          .update({ status: state === 'open' ? 'connected' : 'disconnected', updated_at: new Date() });

        const io = req.app.get('io');
        if (io) {
          io.emit('whatsapp_status', { instance: session, state });
        }
        break;
      }

      case 'qrcode.updated':
      case 'QRCODE_UPDATED': {
        const data = body.payload || body.data;
        const io = req.app.get('io');
        if (io) {
          io.emit('qrcode_updated', {
            instance: session,
            qrCode: data?.qrcode?.base64 || data?.qrcode
          });
        }
        break;
      }

      default:
        console.log(`[Webhook] Evento não tratado: ${event}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('[Webhook] Erro:', error.message);
    res.status(200).json({ received: true, error: error.message });
  }
});

module.exports = router;
