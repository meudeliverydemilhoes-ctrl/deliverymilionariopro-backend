const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/database');
const evolutionService = require('./evolution.service');

/**
 * Chatbot Service - Integração com Claude (Anthropic)
 * Responde automaticamente mensagens do WhatsApp usando IA
 */
class ChatbotService {
  constructor() {
    this.client = null;
    this._initClient();
  }

  /**
   * Inicializar cliente Anthropic
   * Só cria o cliente se a API key estiver configurada
   */
  _initClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'COLE-SUA-CHAVE-ANTHROPIC-AQUI') {
      this.client = new Anthropic({ apiKey });
      console.log('[Chatbot] Cliente Anthropic inicializado');
    } else {
      console.warn('[Chatbot] API Key Anthropic não configurada - chatbot desativado');
      console.warn('[Chatbot] Configure ANTHROPIC_API_KEY no .env');
      console.warn('[Chatbot] Crie sua chave em: https://console.anthropic.com/settings/keys');
    }
  }

  /**
   * Verificar se o chatbot está disponível
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Gerar resposta usando Claude
   * @param {string} systemPrompt - Prompt do sistema (personalidade do bot)
   * @param {Array} conversationHistory - Histórico [{role, content}]
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} model - Modelo Claude a usar
   * @param {number} temperature - Criatividade (0-1)
   * @returns {Promise<string>} Resposta gerada
   */
  async generateResponse(systemPrompt, conversationHistory = [], userMessage, model = 'claude-sonnet-4-6', temperature = 0.7) {
    if (!this.client) {
      throw new Error('Cliente Anthropic não configurado. Configure ANTHROPIC_API_KEY no .env');
    }

    try {
      const messages = [
        ...conversationHistory.slice(-20), // Últimas 20 mensagens para contexto
        { role: 'user', content: userMessage }
      ];

      const response = await this.client.messages.create({
        model: model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
        temperature: temperature
      });

      return response.content[0].text;
    } catch (error) {
      console.error('[Chatbot] Erro na API Anthropic:', error.message);

      if (error.status === 401) {
        throw new Error('API Key Anthropic inválida. Verifique a chave no .env');
      }
      if (error.status === 429) {
        throw new Error('Limite de requisições excedido. Aguarde um momento.');
      }
      throw new Error(`Erro ao gerar resposta: ${error.message}`);
    }
  }

  /**
   * Processar mensagem recebida e responder automaticamente
   * Fluxo completo: busca config → monta contexto → gera resposta → envia via WhatsApp
   */
  async processIncomingMessage(leadId, messageContent) {
    try {
      if (!this.client) {
        console.warn('[Chatbot] Ignorando - API Key não configurada');
        return null;
      }

      // 1. Buscar lead
      const lead = await db('leads').where('id', leadId).first();
      if (!lead) throw new Error(`Lead ${leadId} não encontrado`);

      // 2. Buscar configuração do chatbot
      const config = await db('chatbot_config').where('is_active', true).first();
      if (!config) {
        console.log('[Chatbot] Nenhuma configuração ativa encontrada');
        return null;
      }

      // 3. Verificar horário de funcionamento
      if (config.working_hours_start && config.working_hours_end) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (currentTime < config.working_hours_start || currentTime > config.working_hours_end) {
          console.log(`[Chatbot] Fora do horário (${config.working_hours_start}-${config.working_hours_end})`);
          return null;
        }
      }

      // 4. Buscar histórico da conversa
      const conversation = await db('conversations')
        .where('lead_id', leadId)
        .first();

      if (!conversation) return null;

      const history = await db('messages')
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'asc')
        .limit(20);

      // 5. Montar contexto do histórico
      const conversationHistory = history
        .filter(msg => msg.content && msg.content !== '[Mídia recebida]')
        .map(msg => ({
          role: msg.from_type === 'lead' ? 'user' : 'assistant',
          content: msg.content
        }));

      // 6. Montar system prompt com contexto do lead
      const systemPrompt = `${config.system_prompt || 'Você é um assistente de vendas amigável e profissional.'}

INFORMAÇÕES DO LEAD:
- Nome: ${lead.name || 'Não informado'}
- Telefone: ${lead.phone}
- Etapa do funil: ${lead.stage}
- Score: ${lead.score}/100
- Origem: ${lead.source || 'WhatsApp'}

REGRAS IMPORTANTES:
- Responda de forma natural e amigável, como uma pessoa real
- Use emojis com moderação
- Seja breve (máximo 3 parágrafos)
- Se o cliente perguntar algo que você não sabe, diga que vai verificar com a equipe
- Nunca invente preços ou promoções que não foram informados no prompt
- Se o lead demonstrar interesse em comprar, sugira falar com um atendente humano`;

      // 7. Gerar resposta com Claude
      const response = await this.generateResponse(
        systemPrompt,
        conversationHistory,
        messageContent,
        config.model || 'claude-sonnet-4-6',
        config.temperature || 0.7
      );

      // 8. Salvar resposta do bot no banco
      await db('messages').insert({
        conversation_id: conversation.id,
        from_type: 'bot',
        content: response,
        media_type: 'text',
        status: 'sent',
        created_at: new Date()
      });

      // 9. Enviar via WhatsApp
      await evolutionService.sendText(lead.phone, response);

      // 10. Atualizar conversa
      await db('conversations')
        .where('id', conversation.id)
        .update({
          last_message: response,
          last_message_at: new Date(),
          updated_at: new Date()
        });

      console.log(`[Chatbot] Respondeu para ${lead.name} (${lead.phone})`);

      return {
        success: true,
        response: response,
        leadId: leadId,
        leadName: lead.name
      };

    } catch (error) {
      console.error(`[Chatbot] Erro ao processar mensagem do lead ${leadId}:`, error.message);
      throw error;
    }
  }

  /**
   * Buscar configuração do chatbot
   */
  async getConfig() {
    return await db('chatbot_config').first();
  }

  /**
   * Atualizar configuração do chatbot
   */
  async updateConfig(configData) {
    const existing = await db('chatbot_config').first();

    if (existing) {
      await db('chatbot_config')
        .where('id', existing.id)
        .update({ ...configData, updated_at: new Date() });
    } else {
      await db('chatbot_config').insert({
        ...configData,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Se a API key mudou, reinicializar cliente
    if (configData.api_key_encrypted) {
      process.env.ANTHROPIC_API_KEY = configData.api_key_encrypted;
      this._initClient();
    }

    return this.getConfig();
  }

  /**
   * Testar o chatbot com uma mensagem
   */
  async testBot(testMessage, systemPrompt) {
    const prompt = systemPrompt || 'Você é um assistente de vendas amigável.';
    const response = await this.generateResponse(prompt, [], testMessage);
    return { input: testMessage, output: response };
  }
}

// Singleton
const chatbotService = new ChatbotService();
module.exports = chatbotService;
