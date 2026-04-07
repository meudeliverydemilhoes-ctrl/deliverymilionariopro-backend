exports.up = async function(knex) {
  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.enum('role', ['admin', 'supervisor', 'attendant']).notNullable().defaultTo('attendant');
    table.string('avatar_url');
    table.string('phone');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('email');
    table.index('is_active');
  });

  // Create whatsapp_instances table
  await knex.schema.createTable('whatsapp_instances', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('instance_name').notNullable();
    table.string('instance_id').notNullable();
    table.string('phone_number').notNullable();
    table.enum('status', ['connected', 'disconnected', 'connecting']).notNullable().defaultTo('disconnected');
    table.string('api_url');
    table.text('api_key');
    table.boolean('auto_reconnect').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id');
    table.index('status');
    table.index('phone_number');
  });

  // Create whatsapp_groups table
  await knex.schema.createTable('whatsapp_groups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('instance_id').notNullable().references('id').inTable('whatsapp_instances').onDelete('CASCADE');
    table.string('group_id').notNullable();
    table.string('name').notNullable();
    table.integer('members_count').notNullable().defaultTo(0);
    table.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');
    table.text('last_message');
    table.timestamp('last_message_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('instance_id');
    table.index('group_id');
    table.index('status');
  });

  // Create funnel_stages table (created early as it's referenced by leads)
  await knex.schema.createTable('funnel_stages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.integer('position').notNullable();
    table.string('color');
    table.string('icon');
    table.boolean('is_default').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('position');
  });

  // Create leads table
  await knex.schema.createTable('leads', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('phone').notNullable().unique();
    table.string('email');
    table.string('avatar_url');
    table.integer('score').notNullable().defaultTo(0);
    table.enum('stage', ['lead', 'contact', 'proposal', 'closed', 'lost']).notNullable().defaultTo('lead');
    table.enum('priority', ['urgent', 'high', 'normal', 'low']).notNullable().defaultTo('normal');
    table.string('source');
    table.uuid('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    table.text('notes');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('assigned_to');
    table.index('stage');
    table.index('priority');
    table.index('phone');
  });

  // Create conversations table
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');
    table.uuid('instance_id').notNullable().references('id').inTable('whatsapp_instances').onDelete('CASCADE');
    table.uuid('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    table.enum('status', ['open', 'waiting', 'closed']).notNullable().defaultTo('open');
    table.text('last_message');
    table.timestamp('last_message_at');
    table.integer('unread_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('lead_id');
    table.index('instance_id');
    table.index('assigned_to');
    table.index('status');
    table.unique(['lead_id', 'instance_id']);
  });

  // Create messages table
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    table.enum('from_type', ['lead', 'attendant', 'bot']).notNullable();
    table.text('from_id').notNullable();
    table.text('content').notNullable();
    table.enum('media_type', ['text', 'image', 'audio', 'video', 'document']).notNullable().defaultTo('text');
    table.text('media_url');
    table.enum('status', ['sent', 'delivered', 'read', 'error']).notNullable().defaultTo('sent');
    table.string('whatsapp_message_id');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('conversation_id');
    table.index('from_type');
    table.index('created_at');
  });

  // Create lead_notes table
  await knex.schema.createTable('lead_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('content').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('lead_id');
    table.index('user_id');
  });

  // Create campaigns table
  await knex.schema.createTable('campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('message_template').notNullable();
    table.integer('contacts_count').notNullable().defaultTo(0);
    table.integer('sent_count').notNullable().defaultTo(0);
    table.integer('delivered_count').notNullable().defaultTo(0);
    table.integer('error_count').notNullable().defaultTo(0);
    table.enum('status', ['draft', 'scheduled', 'sending', 'completed', 'cancelled']).notNullable().defaultTo('draft');
    table.timestamp('scheduled_at');
    table.uuid('instance_id').notNullable().references('id').inTable('whatsapp_instances').onDelete('CASCADE');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('instance_id');
    table.index('created_by');
    table.index('status');
  });

  // Create campaign_contacts table
  await knex.schema.createTable('campaign_contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('phone').notNullable();
    table.enum('status', ['pending', 'sent', 'delivered', 'error']).notNullable().defaultTo('pending');
    table.text('error_message');
    table.timestamp('sent_at');
    table.index('campaign_id');
    table.index('status');
  });

  // Create chatbot_config table
  await knex.schema.createTable('chatbot_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('api_key_encrypted');
    table.text('system_prompt');
    table.string('model').notNullable().defaultTo('claude-sonnet-4-6');
    table.float('temperature').notNullable().defaultTo(0.7);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.time('working_hours_start');
    table.time('working_hours_end');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id');
  });

  // Create followup_rules table
  await knex.schema.createTable('followup_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.integer('trigger_hours').notNullable();
    table.enum('priority', ['urgent', 'normal', 'low']).notNullable().defaultTo('normal');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('notify_whatsapp').notNullable().defaultTo(false);
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('created_by');
    table.index('is_active');
  });

  // Create alerts table
  await knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.enum('type', ['followup', 'cold_lead', 'new_lead', 'urgent']).notNullable();
    table.text('message').notNullable();
    table.enum('priority', ['urgent', 'normal', 'low']).notNullable().defaultTo('normal');
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('lead_id');
    table.index('user_id');
    table.index('is_read');
    table.index('type');
  });

  // Create seller_metrics table
  await knex.schema.createTable('seller_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.date('date').notNullable();
    table.integer('leads_count').notNullable().defaultTo(0);
    table.integer('closed_count').notNullable().defaultTo(0);
    table.integer('calls_count').notNullable().defaultTo(0);
    table.integer('avg_response_time_seconds');
    table.integer('messages_sent').notNullable().defaultTo(0);
    table.integer('messages_received').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id');
    table.index('date');
    table.unique(['user_id', 'date']);
  });

  // Create internal_chat table
  await knex.schema.createTable('internal_chat', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('from_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('to_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message').notNullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('from_user_id');
    table.index('to_user_id');
    table.index('is_read');
  });
};

exports.down = async function(knex) {
  // Drop all tables in reverse order of creation (respecting foreign keys)
  await knex.schema.dropTableIfExists('internal_chat');
  await knex.schema.dropTableIfExists('seller_metrics');
  await knex.schema.dropTableIfExists('alerts');
  await knex.schema.dropTableIfExists('followup_rules');
  await knex.schema.dropTableIfExists('chatbot_config');
  await knex.schema.dropTableIfExists('campaign_contacts');
  await knex.schema.dropTableIfExists('campaigns');
  await knex.schema.dropTableIfExists('lead_notes');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('conversations');
  await knex.schema.dropTableIfExists('leads');
  await knex.schema.dropTableIfExists('funnel_stages');
  await knex.schema.dropTableIfExists('whatsapp_groups');
  await knex.schema.dropTableIfExists('whatsapp_instances');
  await knex.schema.dropTableIfExists('users');
};
