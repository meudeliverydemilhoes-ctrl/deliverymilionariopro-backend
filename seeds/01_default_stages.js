exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('funnel_stages').del();

  // Inserts seed entries
  await knex('funnel_stages').insert([
    {
      name: 'Novo Lead',
      position: 1,
      color: '#3B82F6',
      icon: 'plus-circle',
      is_default: true,
      created_at: knex.fn.now()
    },
    {
      name: 'Contato Feito',
      position: 2,
      color: '#10B981',
      icon: 'message-circle',
      is_default: true,
      created_at: knex.fn.now()
    },
    {
      name: 'Proposta Enviada',
      position: 3,
      color: '#F59E0B',
      icon: 'send',
      is_default: true,
      created_at: knex.fn.now()
    },
    {
      name: 'Negociação',
      position: 4,
      color: '#8B5CF6',
      icon: 'handshake',
      is_default: true,
      created_at: knex.fn.now()
    },
    {
      name: 'Fechado',
      position: 5,
      color: '#06B6D4',
      icon: 'check-circle',
      is_default: true,
      created_at: knex.fn.now()
    },
    {
      name: 'Perdido',
      position: 6,
      color: '#EF4444',
      icon: 'x-circle',
      is_default: true,
      created_at: knex.fn.now()
    }
  ]);
};
