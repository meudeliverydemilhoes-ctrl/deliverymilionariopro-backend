/**
 * Migration FASE 1 - Bot Inteligente
 *
 * Adiciona:
 * 1. Colunas estruturadas em LEADS pra ficha do lead (cidade, faturamento, etc)
 * 2. Colunas em CONVERSATIONS pra handoff bot/humano (bot_paused_at, bot_paused_until)
 * 3. Tabela FOLLOW_UPS pra job de lembretes automaticos
 *
 * Migration aditiva - nao remove nem altera nenhuma coluna existente.
 */

exports.up = async function(knex) {
  // ====================================================================
  // 1. LEADS: Adicionar campos estruturados de qualificacao
  // ====================================================================
  await knex.schema.alterTable('leads', (table) => {
    table.string('city');
    table.string('time_in_market'); // ex: "2 anos", "6 meses"
    table.enum('business_model', ['delivery', 'salao', 'hibrido', 'sem_negocio']).nullable();
    table.integer('monthly_revenue_cents').nullable(); // em centavos pra precisao
    table.string('revenue_range').nullable(); // ex: "ate_30k", "30_80k", "80_150k", "acima_150k"
    table.text('main_challenge').nullable();
    table.string('investment_capacity_range').nullable(); // pra leads sem negocio: "ate_50k", "50_150k", "acima_150k"
    table.enum('qualification_stage', [
      'new', 'asking_name', 'asking_city', 'asking_time', 'asking_model',
      'asking_revenue', 'asking_challenge', 'qualified', 'scheduling',
      'scheduled', 'declined', 'unqualified'
    ]).defaultTo('new');
    table.timestamp('qualified_at').nullable();
    table.string('preferred_contact_day').nullable(); // ex: "segunda inicio", "sexta final"
    table.string('preferred_contact_period').nullable(); // ex: "manha", "tarde"
    table.timestamp('next_followup_at').nullable();
    table.integer('followup_count').notNullable().defaultTo(0);
    table.boolean('material_sent').notNullable().defaultTo(false);
    table.text('bot_notes').nullable(); // notas que o bot deixa pra humano

    table.index('qualification_stage');
    table.index('next_followup_at');
    table.index('revenue_range');
  });
  console.log('[Migration] LEADS: campos de qualificacao adicionados');

  // ====================================================================
  // 2. CONVERSATIONS: Adicionar handoff bot/humano
  // ====================================================================
  await knex.schema.alterTable('conversations', (table) => {
    table.timestamp('bot_paused_at').nullable();
    table.timestamp('bot_paused_until').nullable();
    table.uuid('bot_paused_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('bot_paused_reason').nullable(); // 'manual', 'human_responded', 'mentorado', 'unqualified'
    table.timestamp('last_bot_response_at').nullable();
    table.timestamp('last_human_response_at').nullable();
    table.integer('bot_response_count').notNullable().defaultTo(0);

    table.index('bot_paused_until');
    table.index('last_human_response_at');
  });
  console.log('[Migration] CONVERSATIONS: campos de handoff adicionados');

  // ====================================================================
  // 3. FOLLOW_UPS: Tabela de lembretes agendados
  // ====================================================================
  await knex.schema.createTable('follow_ups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    table.timestamp('scheduled_at').notNullable();
    table.enum('status', ['pending', 'sent', 'cancelled', 'failed']).notNullable().defaultTo('pending');
    table.string('reason'); // ex: 'sem_resposta_24h', 'reschedule_call', 'envio_material'
    table.text('message_template').nullable(); // template da mensagem
    table.text('actual_message_sent').nullable(); // mensagem real enviada (depois de Claude formatar)
    table.timestamp('sent_at').nullable();
    table.text('error').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('scheduled_at');
    table.index('status');
    table.index(['status', 'scheduled_at']);
    table.index('lead_id');
  });
  console.log('[Migration] FOLLOW_UPS: tabela criada');

  console.log('[Migration] FASE 1 completa - schema pronto pra bot inteligente');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('follow_ups');
  await knex.schema.alterTable('conversations', (table) => {
    table.dropColumn('bot_paused_at');
    table.dropColumn('bot_paused_until');
    table.dropColumn('bot_paused_by');
    table.dropColumn('bot_paused_reason');
    table.dropColumn('last_bot_response_at');
    table.dropColumn('last_human_response_at');
    table.dropColumn('bot_response_count');
  });
  await knex.schema.alterTable('leads', (table) => {
    table.dropColumn('city');
    table.dropColumn('time_in_market');
    table.dropColumn('business_model');
    table.dropColumn('monthly_revenue_cents');
    table.dropColumn('revenue_range');
    table.dropColumn('main_challenge');
    table.dropColumn('investment_capacity_range');
    table.dropColumn('qualification_stage');
    table.dropColumn('qualified_at');
    table.dropColumn('preferred_contact_day');
    table.dropColumn('preferred_contact_period');
    table.dropColumn('next_followup_at');
    table.dropColumn('followup_count');
    table.dropColumn('material_sent');
    table.dropColumn('bot_notes');
  });
};
