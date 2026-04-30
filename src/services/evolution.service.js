const axios = require('axios');
const db = require('../config/database');

class EvolutionService {
  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'default';
    this.platform = process.env.WHATSAPP_PLATFORM || 'waha';

    // Centralized webhook events list
    this.webhookEvents = ['message', 'message.any', 'session.status'];

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`[WAHA] Conectando em: ${this.apiUrl}`);
    console.log(`[WAHA] Sessao: ${this.instanceName}`);
  }

  // Helper: build webhook config for session start
  _buildWebhookConfig() {
    const webhookUrl = process.env.WEBHOOK_URL || '';
    return {
      webhooks: webhookUrl ? [{
        url: webhookUrl,
        events: this.webhookEvents
      }] : []
    };
  }

  // Helper: clean phone/chatId - strips all WhatsApp suffixes
  _cleanPhone(rawId) {
    if (!rawId) return '';
    return rawId
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace('@g.us', '')
      .replace('@lid', '')
      .replace('@broadcast', '')
      .trim();
  }

  // Helper: check if chatId is a group or broadcast (not a direct contact)
  _isGroupOrBroadcast(chatId) {
    if (!chatId) return false;
    return chatId.includes('@g.us') ||
           chatId.includes('@broadcast') ||
           chatId.includes('120363') || // WhatsApp community/group prefix
           chatId.includes('-'); // group IDs contain dashes
  }

  // ============================================
  // INSTANCIA / CONEXAO
  // ============================================

  async createInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;

      const response = await this.client.post('/api/sessions/start', {
        name: name,
        config: this._buildWebhookConfig()
      });

      console.log(`[WAHA] Sessao "${name}" criada`);

      await new Promise(r => setTimeout(r, 3000));

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
      console.error('[WAHA] Erro ao criar sessao:', error.response?.data || error.message);
      throw new Error(`Falha ao criar sessao: ${error.response?.data?.message || error.message}`);
    }
  }

  async getQRCode(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;

      let sessionStatus;
      try {
        const statusResp = await this.client.get(`/api/sessions/${name}`);
        sessionStatus = statusResp.data?.status;
      } catch (e) {
        sessionStatus = null;
      }

      if (!sessionStatus || sessionStatus === 'FAILED' || sessionStatus === 'STOPPED') {
        try { await this.client.post('/api/sessions/stop', { name }); } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));

        await this.client.post('/api/sessions/start', {
          name: name,
          config: this._buildWebhookConfig()
        });
        await new Promise(r => setTimeout(r, 4000));
      }

      const qrResponse = await this.client.get(`/api/${name}/auth/qr`, {
        responseType: 'arraybuffer'
      });
      const base64 = Buffer.from(qrResponse.data).toString('base64');
      const qrBase64 = `data:image/png;base64,${base64}`;

      return { base64: qrBase64, code: qrBase64 };
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

      const response = await this.client.post('/api/sessions/start', {
        name: name,
        config: this._buildWebhookConfig()
      });

      console.log(`[WAHA] Sessao "${name}" reiniciada`);
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
      console.log(`[WAHA] Sessao "${name}" desconectada`);
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

      console.log(`[WAHA] Midia enviada para ${number}`);
      return response.data;
    } catch (error) {
      console.error('[WAHA] Erro ao enviar midia:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar midia: ${error.response?.data?.message || error.message}`);
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
    } catch (error) {
      return [];
    }
  }

  async getGroups(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/api/${name}/groups`);
      return (response.data || []).map(g => ({
        id: g.id,
        subject: g.subject || g.name,
        size: g.participants?.length || 0,
        creation: g.creation,
        desc: g.description || ''
      }));
    } catch (error) {
      return [];
    }
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

      const response = await this.client.get('/api/contacts/profile-picture', {
        params: { session: name, contactId: chatId }
      });

      return { profilePictureUrl: response.data?.profilePictureUrl || null };
    } catch (error) {
      return { profilePictureUrl: null };
    }
  }

  async checkWhatsAppNumber(phone, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const response = await this.client.get('/api/contacts/check-exists', {
        params: { phone: number, session: name }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Falha ao verificar numero: ${error.response?.data?.message || error.message}`);
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
        config: {
          webhooks: [{
            url: webhookUrl,
            events: this.webhookEvents
          }]
        }
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
    } catch (error) {
      return [];
    }
  }

  // ============================================
  // HELPERS INTERNOS
  // ============================================

  async _getOrCreateInstance() {
    let instance = await db('whatsapp_instances')
      .where('instance_name', this.instanceName)
      .first();

    if (!instance) {
      console.log(`[WAHA] Criando registro de instancia "${this.instanceName}" no banco`);
      let user = await db('users').where('role', 'admin').first();
      if (!user) { user = await db('users').first(); }

      [instance] = await db('whatsapp_instances').insert({
        user_id: user ? user.id : null,
        instance_name: this.instanceName,
        status: 'connected',
        api_url: this.apiUrl,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');
    }

    return instance;
  }

  async _saveOutgoingMessage(phone, content, mediaType, apiResponse) {
    try {
      const cleanedPhone = this._cleanPhone(phone);

      let conversation = await db('conversations')
        .whereRaw("lead_id IN (SELECT id FROM leads WHERE phone = ?)", [cleanedPhone])
        .first();

      if (!conversation) {
        let lead = await db('leads').where('phone', cleanedPhone).first();
        if (!lead) {
          [lead] = await db('leads').insert({
            name: 'Novo Contato',
            phone: cleanedPhone,
            stage: 'lead',
            priority: 'normal',
            score: 0
          }).returning('*');
        }

        const instance = await this._getOrCreateInstance();

        [conversation] = await db('conversations').insert({
          lead_id: lead.id,
          instance_id: instance.id,
          status: 'open',
          last_message: content,
          last_message_at: new Date()
        }).returning('*');
      }

      await db('messages').insert({
        conversation_id: conversation.id,
        from_type: 'attendant',
        from_id: 'system',
        content,
        media_type: mediaType,
        status: 'sent',
        whatsapp_message_id: apiResponse?.key?.id || apiResponse?.id || null,
        created_at: new Date()
      });

      await db('conversations').where('id', conversation.id).update({
        last_message: content,
        last_message_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      console.error('[WAHA] Erro ao salvar mensagem:', error.message);
    }
  }

  async processIncomingMessage(webhookData) {
    // ── PATCH: normaliza payload Evolution API (Baileys) → formato WAHA ──
    if (webhookData?.data?.key?.remoteJid && !webhookData.payload) {
      const d = webhookData.data;
      const msg = d.message || {};
      const text = msg.conversation
                || msg.extendedTextMessage?.text
                || msg.imageMessage?.caption
                || msg.videoMessage?.caption
                || '[Mídia]';
      webhookData = {
        event: webhookData.event,
        session: webhookData.instance,
        instance: webhookData.instance,
        payload: {
          from: d.key.remoteJid,
          to: d.key.remoteJid,
          chatId: d.key.remoteJid,
          fromMe: d.key.fromMe,
          body: text,
          text: { body: text },
          notifyName: d.pushName,
          pushName: d.pushName,
          id: d.key.id,
          _data: d
        }
      };
      console.log('[Adapter] Payload Evolution normalizado para WAHA');
    }
    // ── /PATCH ──

    try {
      const payload = webhookData.payload || webhookData.data;
      if (!payload) {
        console.log('[WAHA] Webhook sem payload, ignorando');
        return null;
      }

      // Log raw webhook for debugging
      const event = webhookData.event || 'unknown';
      const rawFrom = payload.from || payload.chatId || '';
      const rawTo = payload.to || '';
      console.log(`[WAHA] Processando evento=${event} from=${rawFrom} to=${rawTo} fromMe=${payload.fromMe}`);

      const fromMe = payload.fromMe || payload.key?.fromMe || false;

      // Determine the chatId (who we're talking to)
      let rawChatId;
      if (fromMe) {
        rawChatId = payload.to || payload.chatId || '';
      } else {
        rawChatId = payload.from || payload.chatId || '';
      }

      // Skip status broadcasts
      if (rawChatId.includes('status@broadcast') || rawChatId === 'status@broadcast') {
        console.log('[WAHA] Ignorando status broadcast');
        return null;
      }

      // Detect groups and broadcasts
      const isGroup = this._isGroupOrBroadcast(rawChatId);

      // Skip group messages for now (they create noise)
      if (isGroup) {
        console.log(`[WAHA] Ignorando mensagem de grupo: ${rawChatId}`);
        return null;
      }

      // Clean the phone number (strip all WhatsApp suffixes)
      const phone = this._cleanPhone(rawChatId);

      if (!phone) {
        console.log('[WAHA] Telefone vazio apos limpeza, ignorando');
        return null;
      }

      // Extract message content
      let content;
      if (this.platform === 'waha') {
        content = payload.body || payload.text || payload.caption || '';
        if (!content && payload.hasMedia) content = '[Midia recebida]';
        if (!content && payload.type && payload.type !== 'chat') content = `[${payload.type}]`;
        if (!content) content = '[Mensagem]';
      } else {
        const messageData = payload?.message;
        const key = payload?.key;
        if (!key || !messageData) return null;
        content = messageData.conversation || messageData.extendedTextMessage?.text || messageData.imageMessage?.caption || '[Midia recebida]';
      }

      // Extract pushName from multiple possible locations
      let pushName = null;
      if (this.platform === 'waha') {
        pushName = payload.notifyName
          || payload._data?.notifyName
          || payload.pushName
          || payload.senderName
          || payload.verifiedBizName
          || null;
      } else {
        pushName = payload.pushName || null;
      }

      console.log(`[WAHA] Phone=${phone} pushName=${pushName} fromMe=${fromMe} content=${content.substring(0, 50)}`);

      // Find or create lead
      let lead = await db('leads').where('phone', phone).first();

      if (!lead) {
        const leadName = pushName || 'Desconhecido';
        [lead] = await db('leads').insert({
          name: leadName,
          phone,
          stage: 'lead',
          priority: 'normal',
          score: 10,
          source: 'whatsapp_direct'
        }).returning('*');
        console.log(`[WAHA] Novo lead criado: ${leadName} (${phone})`);
      }

      // Update lead name if we have a real pushName and current name is generic
      if (lead && pushName && pushName !== 'Desconhecido' &&
          (lead.name === 'Desconhecido' || lead.name === 'Novo Contato')) {
        await db('leads').where('id', lead.id).update({
          name: pushName,
          updated_at: new Date()
        });
        lead.name = pushName;
        console.log(`[WAHA] Lead atualizado com nome: ${pushName} (${phone})`);
      }

      // Find or create conversation
      let conversation = await db('conversations').where('lead_id', lead.id).first();

      if (!conversation) {
        const instance = await this._getOrCreateInstance();
        [conversation] = await db('conversations').insert({
          lead_id: lead.id,
          instance_id: instance.id,
          status: 'open',
          last_message: content,
          last_message_at: new Date(),
          unread_count: fromMe ? 0 : 1
        }).returning('*');
        console.log(`[WAHA] Nova conversa criada para lead ${lead.id}`);
      } else {
        const updateData = {
          last_message: content,
          last_message_at: new Date(),
          status: 'open',
          updated_at: new Date()
        };
        if (!fromMe) {
          updateData.unread_count = db.raw('unread_count + 1');
        }
        await db('conversations').where('id', conversation.id).update(updateData);
      }

      // Detect media type
      let mediaType = 'text';
      if (payload.hasMedia || payload.mediaUrl) {
        if (payload.type === 'image' || payload.mimetype?.startsWith('image')) mediaType = 'image';
        else if (payload.type === 'video' || payload.mimetype?.startsWith('video')) mediaType = 'video';
        else if (payload.type === 'audio' || payload.type === 'ptt') mediaType = 'audio';
        else if (payload.type === 'document') mediaType = 'document';
      }

      // Save message
      const [savedMessage] = await db('messages').insert({
        conversation_id: conversation.id,
        from_type: fromMe ? 'attendant' : 'lead',
        from_id: fromMe ? 'system' : phone,
        content,
        media_type: mediaType,
        status: fromMe ? 'sent' : 'delivered',
        whatsapp_message_id: payload.id || payload.key?.id || null,
        created_at: new Date()
      }).returning('*');

      console.log(`[WAHA] Mensagem salva: id=${savedMessage.id} fromMe=${fromMe} type=${mediaType}`);

      return {
        lead, conversation, message: savedMessage,
        content, phone, pushName, isGroup
      };
    } catch (error) {
      console.error('[WAHA] Erro ao processar mensagem:', error.message, error.stack);
      throw error;
    }
  }
}

const evolutionService = new EvolutionService();
module.exports = evolutionService;
