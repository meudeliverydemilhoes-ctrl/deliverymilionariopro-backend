exports.up = async function(knex) {
  // Make instance_id and phone_number nullable
  await knex.schema.alterTable('whatsapp_instances', (table) => {
    table.string('instance_id').nullable().alter();
    table.string('phone_number').nullable().alter();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('whatsapp_instances', (table) => {
    table.string('instance_id').notNullable().alter();
    table.string('phone_number').notNullable().alter();
  });
};
