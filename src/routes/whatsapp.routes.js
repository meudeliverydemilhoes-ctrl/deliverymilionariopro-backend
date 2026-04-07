const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const evolutionService = require('../services/evolution.service');
const chatbotService = require('../services/anthropic.service');
const db = require('../config/database');

/**
 * POST /api/v1/whatsapp/connect
 * Conectar WhatsApp via QR Code (Evolution API)
 */
router.post('/connect', verifyToken, async (req, res) => {
  try {
    // Tenta obter QR Code da instância existente
    const qrData = await evolutionService.getQRCode();

    // Salvar/atualizar instância no banco
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
        pairingCode: qrData.pairingCode || null,
        status: 'waiting_scan'
      }
    });
  } catch (error) {
    // Se instância não existe, criar uma nova
    if (error.message.includes('not found') || error.message.includes('404')) {
      try {
        const createData = await evolutionService.createInstance();
        res.json({
          success: true,
          message: 'Instância criada! Escaneie o QR Code',
          data: {
            instanceName: evolutionService.instanceName,
            qrCode: createData.qrcode?.base64 || createData,
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
 * Obter QR Code atual
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
 * Status da conexão WhatsApp
 */
router.get('/status', verifyToken, async (req, res) => {
  try {
    const state = await evolutionService.getConnectionState();
    const info = await evolutionService.getInstanceInfo();

    // Atualizar status no banco
    await db('whatsapp_instances')
      .where('instance_name', evolutionService.instanceName)
      .update({
        status: state.instance?.state === 'open' ? 'connected' : 'disconnected',
        phone_number: info?.[0]?.instance?.owner || null,
        updated_at: new Date()
      });

    res.json({
      success: true,
      data: {
        connected: state.instance?.state === 'open',
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
 * Desconectar WhatsApp
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
 * Reiniciar instância
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
 * Listar grupos do WhatsApp
 */
router.get('/groups', verifyToken, async (req, res) => {
  try {
    const groups = await evolutionService.getGroups();

    // Salvar/atualizar grupos no banco
    for (const group of (groups || [])) {
      const existing = await db('whatsapp_groups')
        .where('group_id', group.id)
        .first();

      if (!existing) {
        await db('whatsapp_groups').insert({
          group_id: group.id,
          name: group.subject,
          members_count: group.size || 0,
          status: 'active',
          created_at: new Date()
        });
      } else {
        await db('whatsapp_groups')
          .where('id', existing.id)
          .update({
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
 * Enviar mensagem de texto
 */
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'phone e message são obrigatórios' });
    }

    const result = await evolutionService.sendText(phone, message);

    res.json({
      success: true,
      message: 'Mensagem enviada',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/send-media
 * Enviar mídia (imagem, vídeo, documento)
 */
router.post('/send-media', verifyToken, async (req, res) => {
  try {
    const { phone, mediaUrl, caption, mediaType } = req.body;

    if (!phone || !mediaUrl) {
      return res.status(400).json({ success: false, message: 'phone e mediaUrl são obrigatórios' });
    }

    const result = await evolutionService.sendMedia(phone, mediaUrl, caption, mediaType);

    res.json({
      success: true,
      message: 'Mídia enviada',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/whatsapp/check-number
 * Verificar se número tem WhatsApp
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
 * Configurar webhook
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
 * Receber eventos da Evolution API (webhook)
 * NÃO requer autenticação JWT (chamado pela Evolution API)
 */
router.post('/webhook', async (req, res) => {
  try {
    const { event, instance, data } = req.body;

    console.log(`[Webhook] Evento: ${event} | Instância: ${instance}`);

    switch (event) {
      // ---- Nova mensagem recebida ----
      case 'messages.upsert':
      case 'MESSAGES_UPSERT': {
        const result = await evolutionService.processIncomingMessage(req.body);

        if (result && !result.isGroup) {
          // Verificar se chatbot está ativo
          const botConfig = await db('chatbot_config')
            .where('is_active', true)
            .first();

          if (botConfig) {
            // Responder automaticamente com IA
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

          // Emitir evento via Socket.io para atendentes
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

      // ---- Status da mensagem atualizado ----
      case 'messages.update':
      case 'MESSAGES_UPDATE': {
        if (data?.key?.id && data?.status) {
          const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'read' };
          await db('messages')
            .where('whatsapp_message_id', data.key.id)
            .update({ status: statusMap[data.status] || 'sent' });
        }
        break;
      }

      // ---- Status da conexão ----
      case 'connection.update':
      case 'CONNECTION_UPDATE': {
        const state = data?.state || data?.connection;
        console.log(`[Webhook] Conexão: ${state}`);

        await db('whatsapp_instances')
          .where('instance_name', instance)
          .update({
            status: state === 'open' ? 'connected' : 'disconnected',
            updated_at: new Date()
          });

        // Notificar frontend via Socket.io
        const io = req.app.get('io');
        if (io) {
          io.emit('whatsapp_status', { instance, state });
        }
        break;
      }

      // ---- QR Code atualizado ----
      case 'qrcode.updated':
      case 'QRCODE_UPDATED': {
        const io = req.app.get('io');
        if (io) {
          io.emit('qrcode_updated', {
            instance,
            qrCode: data?.qrcode?.base64 || data?.qrcode
          });
        }
        break;
      }

      // ---- Grupos ----
      case 'groups.upsert':
      case 'GROUPS_UPSERT': {
        console.log(`[Webhook] Grupo atualizado: ${data?.subject || 'desconhecido'}`);
        break;
      }

      default:
        console.log(`[Webhook] Evento não tratado: ${event}`);
    }

    // SEMPRE retornar 200 para Evolution API não reenviar
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Erro:', error.message);
    res.status(200).json({ received: true, error: error.message });
  }
});

module.exports = router;
