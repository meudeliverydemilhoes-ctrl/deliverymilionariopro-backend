const axios = require('axios');
const db = require('../config/database');

/**
 * Evolution API Service v2.3.7
 * Integração real com a Evolution API hospedada no Railway
 * Documentação: https://doc.evolution-api.com
 */
class EvolutionService {
  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'meudelivery';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Log de inicialização
    console.log(`[EvolutionAPI] Conectando em: ${this.apiUrl}`);
    console.log(`[EvolutionAPI] Instância: ${this.instanceName}`);
  }

  // ============================================
  // INSTÂNCIA / CONEXÃO
  // ============================================

  /**
   * Criar nova instância WhatsApp
   * POST /instance/create
   */
  async createInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.post('/instance/create', {
        instanceName: name,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      console.log(`[EvolutionAPI] Instância "${name}" criada`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao criar instância:', error.response?.data || error.message);
      throw new Error(`Falha ao criar instância: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Obter QR Code para conectar WhatsApp
   * GET /instance/connect/{instanceName}
   */
  async getQRCode(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/instance/connect/${name}`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao obter QR Code:', error.response?.data || error.message);
      throw new Error(`Falha ao obter QR Code: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verificar status da conexão
   * GET /instance/connectionState/{instanceName}
   */
  async getConnectionState(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/instance/connectionState/${name}`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao verificar status:', error.response?.data || error.message);
      throw new Error(`Falha ao verificar status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Obter informações completas da instância
   * GET /instance/fetchInstances?instanceName={name}
   */
  async getInstanceInfo(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get('/instance/fetchInstances', {
        params: { instanceName: name }
      });
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao buscar info:', error.response?.data || error.message);
      throw new Error(`Falha ao buscar informações: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Reiniciar instância
   * PUT /instance/restart/{instanceName}
   */
  async restartInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.put(`/instance/restart/${name}`);
      console.log(`[EvolutionAPI] Instância "${name}" reiniciada`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao reiniciar:', error.response?.data || error.message);
      throw new Error(`Falha ao reiniciar: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Desconectar (logout) instância
   * DELETE /instance/logout/{instanceName}
   */
  async logoutInstance(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.delete(`/instance/logout/${name}`);
      console.log(`[EvolutionAPI] Instância "${name}" desconectada`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao desconectar:', error.response?.data || error.message);
      throw new Error(`Falha ao desconectar: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // MENSAGENS
  // ============================================

  /**
   * Enviar mensagem de texto
   * POST /message/sendText/{instanceName}
   */
  async sendText(phone, message, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      // Formatar número: remover espaços, +, traços
      const number = phone.replace(/[\s\-\+\(\)]/g, '');

      const response = await this.client.post(`/message/sendText/${name}`, {
        number: number,
        text: message
      });

      console.log(`[EvolutionAPI] Mensagem enviada para ${number}`);

      // Salvar no banco
      await this._saveOutgoingMessage(number, message, 'text', response.data);

      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao enviar mensagem:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar mensagem: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Enviar mensagem com mídia (imagem, vídeo, documento, áudio)
   * POST /message/sendMedia/{instanceName}
   */
  async sendMedia(phone, mediaUrl, caption = '', mediaType = 'image', instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');

      const response = await this.client.post(`/message/sendMedia/${name}`, {
        number: number,
        mediatype: mediaType, // image, video, document, audio
        media: mediaUrl,
        caption: caption
      });

      console.log(`[EvolutionAPI] Mídia enviada para ${number}`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao enviar mídia:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar mídia: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Enviar mensagem para grupo
   * POST /message/sendText/{instanceName}
   */
  async sendToGroup(groupId, message, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.post(`/message/sendText/${name}`, {
        number: groupId,
        text: message
      });
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao enviar para grupo:', error.response?.data || error.message);
      throw new Error(`Falha ao enviar para grupo: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // CONTATOS E GRUPOS
  // ============================================

  /**
   * Buscar todos os contatos
   * POST /chat/findContacts/{instanceName}
   */
  async getContacts(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.post(`/chat/findContacts/${name}`, {});
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao buscar contatos:', error.response?.data || error.message);
      throw new Error(`Falha ao buscar contatos: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Buscar todos os grupos
   * GET /group/fetchAllGroups/{instanceName}
   */
  async getGroups(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/group/fetchAllGroups/${name}`, {
        params: { getParticipants: false }
      });
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao buscar grupos:', error.response?.data || error.message);
      throw new Error(`Falha ao buscar grupos: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Buscar info de um grupo específico
   * GET /group/findGroupInfos/{instanceName}?groupJid={groupId}
   */
  async getGroupInfo(groupId, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/group/findGroupInfos/${name}`, {
        params: { groupJid: groupId }
      });
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao buscar grupo:', error.response?.data || error.message);
      throw new Error(`Falha ao buscar grupo: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Buscar foto de perfil
   * POST /chat/fetchProfilePictureUrl/{instanceName}
   */
  async getProfilePicture(phone, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const response = await this.client.post(`/chat/fetchProfilePictureUrl/${name}`, {
        number: number
      });
      return response.data;
    } catch (error) {
      return { profilePictureUrl: null };
    }
  }

  /**
   * Verificar se número tem WhatsApp
   * POST /chat/whatsappNumbers/{instanceName}
   */
  async checkWhatsAppNumber(phone, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const number = phone.replace(/[\s\-\+\(\)]/g, '');
      const response = await this.client.post(`/chat/whatsappNumbers/${name}`, {
        numbers: [number]
      });
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao verificar número:', error.response?.data || error.message);
      throw new Error(`Falha ao verificar número: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // WEBHOOK
  // ============================================

  /**
   * Configurar webhook para receber eventos
   * POST /webhook/set/{instanceName}
   */
  async setWebhook(webhookUrl, instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.post(`/webhook/set/${name}`, {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: true,
        events: [
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONTACTS_SET',
          'CONTACTS_UPSERT',
          'CONTACTS_UPDATE',
          'PRESENCE_UPDATE',
          'CHATS_SET',
          'CHATS_UPSERT',
          'CHATS_UPDATE',
          'CHATS_DELETE',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
          'GROUP_PARTICIPANTS_UPDATE',
          'CONNECTION_UPDATE',
          'CALL'
        ]
      });
      console.log(`[EvolutionAPI] Webhook configurado: ${webhookUrl}`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao configurar webhook:', error.response?.data || error.message);
      throw new Error(`Falha ao configurar webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Buscar webhook configurado
   * GET /webhook/find/{instanceName}
   */
  async getWebhook(instanceName = null) {
    try {
      const name = instanceName || this.instanceName;
      const response = await this.client.get(`/webhook/find/${name}`);
      return response.data;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao buscar webhook:', error.response?.data || error.message);
      throw new Error(`Falha ao buscar webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // HELPERS INTERNOS
  // ============================================

  /**
   * Salvar mensagem enviada no banco de dados
   */
  async _saveOutgoingMessage(phone, content, mediaType, apiResponse) {
    try {
      // Buscar conversa existente ou criar nova
      let conversation = await db('conversations')
        .whereRaw("lead_id IN (SELECT id FROM leads WHERE phone = ?)", [phone])
        .first();

      if (!conversation) {
        // Criar lead se não existe
        let lead = await db('leads').where('phone', phone).first();
        if (!lead) {
          [lead] = await db('leads').insert({
            name: 'Novo Contato',
            phone: phone,
            stage: 'lead',
            priority: 'normal',
            score: 0
          }).returning('*');
        }

        [conversation] = await db('conversations').insert({
          lead_id: lead.id,
          status: 'open',
          last_message: content,
          last_message_at: new Date()
        }).returning('*');
      }

      // Salvar mensagem
      await db('messages').insert({
        conversation_id: conversation.id,
        from_type: 'attendant',
        content: content,
        media_type: mediaType,
        status: 'sent',
        whatsapp_message_id: apiResponse?.key?.id || null,
        created_at: new Date()
      });

      // Atualizar conversa
      await db('conversations')
        .where('id', conversation.id)
        .update({
          last_message: content,
          last_message_at: new Date(),
          updated_at: new Date()
        });

    } catch (error) {
      console.error('[EvolutionAPI] Erro ao salvar mensagem:', error.message);
    }
  }

  /**
   * Processar mensagem recebida pelo webhook
   * Chamado pela rota POST /api/v1/whatsapp/webhook
   */
  async processIncomingMessage(webhookData) {
    try {
      const { data } = webhookData;
      const messageData = data?.message;
      const key = data?.key;

      if (!key || !messageData) return null;

      // Ignorar mensagens enviadas por nós
      if (key.fromMe) return null;

      const phone = key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      const isGroup = key.remoteJid.includes('@g.us');
      const content = messageData.conversation ||
                      messageData.extendedTextMessage?.text ||
                      messageData.imageMessage?.caption ||
                      '[Mídia recebida]';
      const pushName = data.pushName || 'Desconhecido';

      // Buscar ou criar lead
      let lead = await db('leads').where('phone', phone).first();
      if (!lead) {
        [lead] = await db('leads').insert({
          name: pushName,
          phone: phone,
          stage: 'lead',
          priority: 'normal',
          score: 10,
          source: isGroup ? 'whatsapp_group' : 'whatsapp_direct'
        }).returning('*');
        console.log(`[EvolutionAPI] Novo lead criado: ${pushName} (${phone})`);
      }

      // Buscar ou criar conversa
      let conversation = await db('conversations')
        .where('lead_id', lead.id)
        .first();

      if (!conversation) {
        [conversation] = await db('conversations').insert({
          lead_id: lead.id,
          status: 'open',
          last_message: content,
          last_message_at: new Date(),
          unread_count: 1
        }).returning('*');
      } else {
        await db('conversations')
          .where('id', conversation.id)
          .update({
            last_message: content,
            last_message_at: new Date(),
            unread_count: db.raw('unread_count + 1'),
            status: 'open',
            updated_at: new Date()
          });
      }

      // Salvar mensagem
      const [savedMessage] = await db('messages').insert({
        conversation_id: conversation.id,
        from_type: 'lead',
        from_id: phone,
        content: content,
        media_type: messageData.imageMessage ? 'image' :
                    messageData.audioMessage ? 'audio' :
                    messageData.videoMessage ? 'video' :
                    messageData.documentMessage ? 'document' : 'text',
        status: 'received',
        whatsapp_message_id: key.id,
        created_at: new Date()
      }).returning('*');

      return {
        lead,
        conversation,
        message: savedMessage,
        content,
        phone,
        pushName,
        isGroup
      };

    } catch (error) {
      console.error('[EvolutionAPI] Erro ao processar mensagem:', error.message);
      throw error;
    }
  }
}

// Singleton
const evolutionService = new EvolutionService();
module.exports = evolutionService;
