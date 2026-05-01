/**
 * Migration: torna messages.from_id nullable
 *
 * O codigo do chatbot insere mensagens do bot sem from_id (porque o bot
 * nao e um user real do banco). O schema original exigia NOT NULL, o que
 * fazia toda resposta da Iza falhar ao salvar e quebrava o contexto da
 * conversa.
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.text('from_id').nullable().alter();
  });
  console.log('[Migration] messages.from_id agora e nullable');
};

exports.down = async function(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.text('from_id').notNullable().alter();
  });
};

