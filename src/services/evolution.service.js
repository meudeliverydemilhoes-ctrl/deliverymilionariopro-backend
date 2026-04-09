const axios = require('axios');
const db = require('../config/database');

/**
 * WAHA (WhatsApp HTTP API) Service
 * Substitui Evolution API - compatível com WAHA hospedado no Railway
 * Documentação: https://waha.devlike.pro/docs/overview/introduction/
 */
class EvolutionService {
  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'default';
    this.platform = process.env.WHATSAPP_PLATFORM || 'waha';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`[WAHA] Conectando em: ${this.apiUrl}`);
    console.log(`[WAHA] Sessão: ${this.instanceName}`);
  }

  // ============================================
  // INSTÂNCIA / CONEXÃO
  // ============================================

  async createInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const webhookUrl = process.env.WEBHOOK_URL || '';

      const response = await this.client.post('/api/sessions/start', {
        name: name,
        config: {
          webhooks: webhookUrl ? [{
            url: webhookUrl,
            events: ['message', 'session.status']
          }] : []
        }
      });

      console.log(`[WAHA] Sessão "${name}" criada`);

      // Aguardar sessão ficar pronta para QR
      await new Promise(r => setTimeout(r, 3000));

      // Buscar QR code
      try {
        const qrResponse = await this.client.get(`/api/${name}/auth/qr`, {
          responseType: 'arraybuffer'
        });
        const base64 = Buffer.from(qrResponse.data).toString('base64');
        const qrBase64 = `data:image/png;base64,${base64}`;

        return {
          qrcode: { base64: qrBase64 },
          instance: { instanceName: name, status: 'created' }
        };
      } catch (qrErr) {
        return { instance: { instanceName: name, status: 'created' } };
      }
    } catch (error) {
      console.error('[WAHA] Erro ao criar sessão:', error.response?.data || error.message);
      throw new Error(`Falha ao criar sessão: ${error.response?.data?.message || error.message}`);
    }
  }

  async getQRCode(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;

      // Verificar status da sessão primeiro
      let sessionStatus;
      try {
        const statusResp = await this.client.get(`/api/sessions/${name}`);
        sessionStatus = statusResp.data?.status;
      } catch (e) {
        sessionStatus = null;
      }

      // Se sessão não existe ou falhou, iniciar nova
      if (!sessionStatus || sessionStatus === 'FAILED' || sessionStatus === 'STOPPED') {
        // Tentar parar primeiro
        try {
          await this.client.post('/api/sessions/stop', { name });
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));

        const webhookUrl = process.env.WEBHOOK_URL || '';
        await this.client.post('/api/sessions/start', {
          name: name,
          config: {
            webhooks: webhookUrl ? [{
              url: webhookUrl,
              events: ['message', 'session.status']
            }] : []
          }
        });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Buscar QR como imagem PNG e converter para base64
      const qrResponse = await this.client.get(`/api/${name}/auth/qr`, {
        responseType: 'arraybuffer'
      });

      const base64 = Buffer.from(qrResponse.data).toString('base64');
      const qrBase64 = `data:image/png;base64,${base64}`;

      return {
        base64: qrBase64,
        code: qrBase64
      };
    } catch (error) {
      console.error('[WAHA] Erro ao obter QR Code:', error.response?.data || error.message);
      throw new Error(`Falha ao obter QR Code: ${error.response?.data?.message || error.message}`);
    }
  }

  async getConnectionState(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/sessions/${name}`);
      const status = response.data?.status;

      // Mapear status WAHA para formato esperado pelo routes
      const stateMap = {
        'WORKING': 'open',
        'SCAN_QR_CODE': 'connecting',
        'STARTING': 'connecting',
        'FAILED': 'close',
        'STOPPED': 'close'
      };

      return {
        instance: {
          instanceName: name,
          state: stateMap[status] || 'close',
          status: status
        }
      };
    } catch (error) {
      console.error('[WAHA] Erro ao verificar status:', error.response?.data || error.message);
      return {
        instance: {
          instanceName: instanceName || this.instanceName,
          state: 'close',
          status: 'error'
        }
      };
    }
  }

  async getInstanceInfo(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/sessions/${name}`);
      const me = response.data?.me;

      return [{
        instance: {
          instanceName: name,
          owner: me?.id?.replace('@c.us', '') || null,
          profileName: me?.pushName || null,
          profilePictureUrl: null,
          status: response.data?.status
        }
      }];
    } catch (error) {
      console.error('[WAHA] Erro ao buscar info:', error.response?.data || error.message);
      return [{
        instance: {
          instanceName: instanceName || this.instanceName,
          owner: null,
          profileName: null,
          profilePictureUrl: null
        }
      }];
    }
  }

  async restartInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      await this.client.post('/api/sessions/stop', { name });
      await new Promise(r => setTimeout(r, 2000));

      const webhookUrl = process.env.WEBHOOK_URL || '';
      const response = await this.client.post('/api/sessions/start', {
        name: name,
        config: {
          webhooks: webhookUrl ? [{
            url: webhookUrl,
            events: ['message', 'session.status']
          }] : []
        }
      });

      console.log(`[WAHA] Sessão "${name}" reiniciada`);
      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao reiniciar:', error.response?.data || error.message);
      throw new Error(`Falha ao reiniciar: ${error.response?.data?.message || error.message}`);
    }
  }

  async logoutInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.post('/api/sessions/stop', { name });
      console.log(`[WAHA] Sessão "${name}" desconectada`);
      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao desconectar:', error.response?.data || error.message);
      throw new Error(`Falha ao desconectar: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // MENSAGENS
  // ============================================

  async sendText(phone, message, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const chatId = number.includes('@') ? number : `${number}@c.us`;

      const response = await this.client.post('/api/sendText', {
        session: name,
        chatId: chatId,
        text: message
      });

      console.log(`[WAHA] Mensagem enviada para ${number}`);
      await this._saveOutgoingMessage(number, message, 'text', response.data);
      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao enviar mensagem:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar mensagem: ${error.response?.data?.message || error.message}`);
    }
  }

  async sendMedia(phone, mediaUrl, caption = '', mediaType = 'image', instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const chatId = number.includes('@') ? number : `${number}@c.us`;

      const response = await this.client.post('/api/sendFile', {
        session: name,
        chatId: chatId,
        file: { url: mediaUrl, caption: caption }
      });

      console.log(`[WAHA] Mídia enviada para ${number}`);
      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao enviar mídia:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar mídia: ${error.response?.data?.message || error.message}`);
    }
  }

  async sendToGroup(groupId, message, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const chatId = groupId.includes('@') ? groupId : `${groupId}@g.us`;

      const response = await this.client.post('/api/sendText', {
        session: name,
        chatId: chatId,
        text: message
      });

      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao enviar para grupo:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar para grupo: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // CONTATOS E GRUPOS
  // ============================================

  async getContacts(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get('/api/contacts', { params: { session: name } });
      return response.data;
    } catch (error) { return []; }
  }

  async getGroups(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/${name}/groups`);
      return (response.data || []).map(g => ({
        id: g.id, subject: g.subject || g.name, size: g.participants?.length || 0, creation: g.creation, desc: g.description || ''
      }));
    } catch (error) { return []; }
  }

  async getGroupInfo(groupId, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/${name}/groups`, { params: { groupId } });
      return response.data;
    } catch (error) {
      throw new Error(`Falha ao buscar grupo: ${error.response?.data?.message || error.message}`);
    }
  }

  async getProfilePicture(phone, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const chatId = number.includes('@') ? number : `${number}@c.us`;
      const response = await this.client.get('/api/contacts/profile-picture', { params: { session: name, contactId: chatId } });
      return { profilePictureUrl: response.data?.profilePictureUrl || null };
    } catch (error) { return { profilePictureUrl: null }; }
  }

  async checkWhatsAppNumber(phone, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const response = await this.client.get('/api/contacts/check-exists', { params: { phone: number, session: name } });
      return response.data;
    } catch (error) {
      throw new Error(`Falha ao verificar número: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // WEBHOOK
  // ============================================

  async setWebhook(webhookUrl, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      await this.client.post('/api/sessions/stop', { name });
      await new Promise(r => setTimeout(r, 2000));

      const response = await this.client.post('/api/sessions/start', {
        name: name,
        config: { webhooks: [{ url: webhookUrl, events: ['message', 'message.any', 'session.status'] }] }
      });

      console.log(`[WAHA] Webhook configurado: ${webhookUrl}`);
      return response.data;
    } catch (error) {
      throw new Error(`Falha ao configurar webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWebhook(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/sessions/${name}`);
      return response.data?.config?.webhooks || [];
    } catch (error) { return []; }
  }

  // ============================================
  // HELPERS INTERNOS
  // ============================================

  async _saveOutgoingMessage(phone, content, mediaType, apiResponse) {
    try {
      let conversation = await db('conversations')
        .whereRaw("lead_id IN (SELECT id FROM leads WHERE phone = ?)", [phone])
        .first();

      if (!conversation) {
        let lead = await db('leads').where('phone', phone).first();
        if (!lead) {
          [lead] = await db('leads').insert({ name: 'Novo Contato', phone, stage: 'lead', priority: 'normal', score: 0 }).returning('*');
        }
        [conversation] = await db('conversations').insert({ lead_id: lead.id, status: 'open', last_message: content, last_message_at: new Date() }).returning('*');
      }

      await db('messages').insert({
        conversation_id: conversation.id, from_type: 'attendant', content, media_type: mediaType,
        status: 'sent', whatsapp_message_id: apiResponse?.key?.id || apiResponse?.id || null, created_at: new Date()
      });

      await db('conversations').where('id', conversation.id).update({ last_message: content, last_message_at: new Date(), updated_at: new Date() });
    } catch (error) {
      console.error('[WAHA] Erro ao salvar mensagem:', error.message);
    }
  }

  async processIncomingMessage(webhookData) {
    try {
      const payload = webhookData.payload || webhookData.data;
      if (!payload) return null;

      const fromMe = payload.fromMe || payload.key?.fromMe;
      if (fromMe) return null;

      let phone, content, pushName, isGroup;

      if (this.platform === 'waha') {
        phone = (payload.from || payload.chatId || '').replace('@c.us', '').replace('@g.us', '');
        content = payload.body || payload.text || payload.caption || '[Mídia recebida]';
        pushName = payload.notifyName || payload._data?.notifyName || 'Desconhecido';
        isGroup = (payload.from || '').includes('@g.us');
      } else {
        const messageData = payload?.message;
        const key = payload?.key;
        if (!key || !messageData) return null;
        phone = key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        isGroup = key.remoteJid.includes('@g.us');
        content = messageData.conversation || messageData.extendedTextMessage?.text || messageData.imageMessage?.caption || '[Mídia recebida]';
        pushName = payload.pushName || 'Desconhecido';
      }

      if (!phone) return null;

      let lead = await db('leads').where('phone', phone).first();
      if (!lead) {
        [lead] = await db('leads').insert({ name: pushName, phone, stage: 'lead', priority: 'normal', score: 10, source: isGroup ? 'whatsapp_group' : 'whatsapp_direct' }).returning('*');
        console.log(`[WAHA] Novo lead criado: ${pushName} (${phone})`);
      }

      let conversation = await db('conversations').where('lead_id', lead.id).first();
      if (!conversation) {
        [conversation] = await db('conversations').insert({ lead_id: lead.id, status: 'open', last_message: content, last_message_at: new Date(), unread_count: 1 }).returning('*');
      } else {
        await db('conversations').where('id', conversation.id).update({ last_message: content, last_message_at: new Date(), unread_count: db.raw('unread_count + 1'), status: 'open', updated_at: new Date() });
      }

      let mediaType = 'text';
      if (payload.hasMedia || payload.mediaUrl) {
        if (payload.type === 'image' || payload.mimetype?.startsWith('image')) mediaType = 'image';
        else if (payload.type === 'video' || payload.mimetype?.startsWith('video')) mediaType = 'video';
        else if (payload.type === 'audio' || payload.type === 'ptt') mediaType = 'audio';
        else if (payload.type === 'document') mediaType = 'document';
      }

      const [savedMessage] = await db('messages').insert({
        conversation_id: conversation.id, from_type: 'lead', from_id: phone, content,
        media_type: mediaType, status: 'received', whatsapp_message_id: payload.id || payload.key?.id || null, created_at: new Date()
      }).returning('*');

      return { lead, conversation, message: savedMessage, content, phone, pushName, isGroup };
    } catch (error) {
      console.error('[WAHA] Erro ao processar mensagem:', error.message);
      throw error;
    }
  }
}

// Singleton
const evolutionService = new EvolutionService();
module.exports = evolutionService;
