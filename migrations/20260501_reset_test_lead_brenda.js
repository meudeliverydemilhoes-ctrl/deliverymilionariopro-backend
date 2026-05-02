/**
 * Migration: reseta o lead de teste da Brenda (555195524398)
 * pra que ela possa testar o primeiro contato da Iza do zero.
 */

exports.up = async function(knex) {
  const phone = '555195524398';

  const lead = await knex('leads').where('phone', phone).first();
  if (!lead) {
    console.log('[Migration] Nenhum lead encontrado com phone ' + phone + ', nada a fazer');
    return;
  }

  console.log('[Migration] Resetando lead ' + lead.id + ' (phone ' + phone + ')');

  const conversations = await knex('conversations').where('lead_id', lead.id);
  console.log('[Migration] ' + conversations.length + ' conversas encontradas');

  for (const conv of conversations) {
    const deletedMessages = await knex('messages').where('conversation_id', conv.id).delete();
    console.log('[Migration] ' + deletedMessages + ' mensagens deletadas da conversa ' + conv.id);
  }

  const deletedConvs = await knex('conversations').where('lead_id', lead.id).delete();
  console.log('[Migration] ' + deletedConvs + ' conversas deletadas');

  const deletedLeads = await knex('leads').where('id', lead.id).delete();
  console.log('[Migration] ' + deletedLeads + ' lead deletado. Pode testar novamente.');
};

exports.down = async function(knex) {
  console.log('[Migration] Down nao implementado - reset de lead nao tem rollback');
};

